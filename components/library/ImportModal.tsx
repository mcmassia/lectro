'use client';

import { useState, useCallback, useRef } from 'react';
import { v4 as uuid } from 'uuid';
import { Book, addBook as dbAddBook } from '@/lib/db';
import { useLibraryStore } from '@/stores/appStore';
// import ePub from 'epubjs';

interface ImportModalProps {
    onClose: () => void;
}

export function ImportModal({ onClose }: ImportModalProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [importing, setImporting] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [errors, setErrors] = useState<string[]>([]);
    const [permissionRequired, setPermissionRequired] = useState(false);
    const [pendingFiles, setPendingFiles] = useState<File[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { addBook } = useLibraryStore();
    const [serverSyncing, setServerSyncing] = useState(false);

    const processEpub = async (file: File): Promise<Partial<Book>> => {
        const ePub = (await import('epubjs')).default;
        const arrayBuffer = await file.arrayBuffer();
        const book = ePub(arrayBuffer);
        await book.ready;

        const metadata = await book.loaded.metadata;
        const coverUrl = await book.coverUrl();

        // Get spine for page count estimation
        const spine = book.spine;
        let estimatedPages = 0;
        if (spine && 'length' in spine) {
            estimatedPages = Math.round((spine as any).length * 15); // Rough estimate
        }

        let coverBase64: string | undefined;
        if (coverUrl) {
            try {
                const response = await fetch(coverUrl);
                const blob = await response.blob();
                coverBase64 = await blobToBase64(blob);
            } catch (e) {
                console.warn('Failed to extract cover');
            }
        }

        book.destroy();

        return {
            title: metadata?.title || file.name.replace(/\.epub$/i, ''),
            author: metadata?.creator || 'Autor desconocido',
            cover: coverBase64,
            format: 'epub',
            totalPages: estimatedPages,
            metadata: {
                publisher: metadata?.publisher,
                language: metadata?.language,
                description: metadata?.description,
            },
        };
    };

    const processPdf = async (file: File): Promise<Partial<Book>> => {
        // For PDF, we'll use basic metadata for now
        // PDF.js would require more setup for full metadata extraction
        return {
            title: file.name.replace(/\.pdf$/i, ''),
            author: 'Autor desconocido',
            format: 'pdf',
            metadata: {},
        };
    };

    const processFile = async (file: File): Promise<void> => {
        const extension = file.name.split('.').pop()?.toLowerCase();

        if (!['epub', 'pdf'].includes(extension || '')) {
            throw new Error(`Formato no soportado: ${extension}`);
        }

        let bookData: Partial<Book>;

        if (extension === 'epub') {
            bookData = await processEpub(file);
        } else {
            bookData = await processPdf(file);
        }

        // Clasificar automáticamente el libro
        let categories: import('@/lib/db').BookCategory[] = [];
        try {
            const { classifyBookCategories } = await import('@/lib/ai/classifier');
            const result = await classifyBookCategories(
                bookData.title || file.name,
                bookData.author || '',
                bookData.metadata?.description,
                bookData.metadata?.subjects
            );
            categories = result.categories;
            console.log(`Book classified as: ${categories.join(', ')} (method: ${result.method})`);
        } catch (e) {
            console.warn('Classification failed:', e);
        }

        const newBook: Book = {
            id: uuid(),
            title: bookData.title || '',
            author: bookData.author || '',
            cover: bookData.cover,
            format: bookData.format || 'epub',
            fileName: file.name,
            fileBlob: file,
            fileSize: file.size,
            addedAt: new Date(),
            progress: 0,
            currentPosition: '',
            totalPages: bookData.totalPages,
            metadata: {
                ...bookData.metadata,
                categories  // Añadir categorías automáticas
            },
            status: 'unread' // Default to unread for imported books
        };

        await dbAddBook(newBook);
        addBook(newBook);


        // Upload to server immediately to ensure availability for Reader
        try {
            console.log('Uploading to server...');
            const { uploadBookToServer } = await import('@/lib/fileSystem');
            await uploadBookToServer(newBook);
            console.log('Upload complete');
        } catch (e) {
            console.error('Failed to upload to server:', e);
            // Don't fail the whole import, but maybe warn?
            // Ideally we show this in the error list but for now log it.
        }

        // Save to file system if configured (Client-side FS Access API)
        try {
            console.log('Attempting to save to client file system...');
            const { getSettings } = await import('@/lib/db');
            const { writeBookToFile, verifyPermission } = await import('@/lib/fileSystem');
            const settings = await getSettings();

            if (settings.libraryHandle) {
                // ... existing client FS logic ...
                const hasPermission = await verifyPermission(settings.libraryHandle, true);
                if (hasPermission) {
                    await writeBookToFile(settings.libraryHandle, file);
                }
            }
        } catch (e) {
            console.error('Failed to save to client file system:', e);
        }
    };

    const handleFiles = useCallback(async (files: FileList | File[]) => {
        const fileArray = Array.from(files);

        // Check permissions upfront
        try {
            const { getSettings } = await import('@/lib/db');
            const { checkPermission } = await import('@/lib/fileSystem');
            const settings = await getSettings();

            if (settings.libraryHandle) {
                const status = await checkPermission(settings.libraryHandle, true);
                if (status === 'prompt' || status === 'denied') {
                    setPendingFiles(fileArray);
                    setPermissionRequired(true);
                    return; // Stop here and wait for user action
                }
            }
        } catch (e) {
            console.error('Error checking permission upfront:', e);
        }

        await processFiles(fileArray);
    }, []);

    const grantPermission = async () => {
        try {
            const { getSettings } = await import('@/lib/db');
            const { verifyPermission } = await import('@/lib/fileSystem');
            const settings = await getSettings();

            if (settings.libraryHandle) {
                const granted = await verifyPermission(settings.libraryHandle, true);
                if (granted) {
                    setPermissionRequired(false);
                    await processFiles(pendingFiles);
                    setPendingFiles([]);
                } else {
                    alert('Permiso denegado. No se podrán guardar los archivos en la carpeta.');
                    setPermissionRequired(false);
                    await processFiles(pendingFiles); // Process anyway, just won't be saved to FS
                }
            }
        } catch (e) {
            console.error('Error granting permission:', e);
            alert('Ocurrió un error al solicitar permisos.');
        }
    };

    const handleMaintenance = async () => {
        if (!confirm('Esta operación verificará todos los libros en la base de datos del servidor y eliminará aquellos cuyos archivos no existan. Esto puede solucionar problemas de libros "fantasma" o duplicados. ¿Deseas continuar?')) {
            return;
        }

        try {
            setServerSyncing(true);
            setErrors([]);

            // Call Cleanup Endpoint
            const customPath = localStorage.getItem('lectro_server_path');
            const headers: HeadersInit = {};
            if (customPath) headers['x-library-path'] = customPath;

            const response = await fetch('/api/library/cleanup', {
                method: 'POST',
                headers
            });

            if (!response.ok) throw new Error('Error en la respuesta del servidor');

            const result = await response.json();

            if (result.success && result.deletedIds && result.deletedIds.length > 0) {
                // Remove from local DB to match server
                const { db } = await import('@/lib/db');

                // Transactional delete
                await db.transaction('rw', [db.books, db.annotations, db.vectorChunks, db.xrayData, db.summaries], async () => {
                    for (const id of result.deletedIds) {
                        await db.books.delete(id);
                        await db.annotations.where('bookId').equals(id).delete();
                        // Clean other tables too
                    }
                });

                // Refresh store
                const { getAllBooks } = await import('@/lib/db');
                const books = await getAllBooks();
                useLibraryStore.getState().setBooks(books);

                alert(`Reparación completada. Se han eliminado ${result.deletedIds.length} libros inválidos.`);
                setTimeout(onClose, 500);

            } else if (result.success) {
                alert('La biblioteca está en buen estado. No se encontraron errores.');
            } else {
                throw new Error(result.error || 'Error desconocido');
            }

        } catch (e) {
            console.error('Maintenance error:', e);
            setErrors(['Error al reparar la biblioteca: ' + (e as Error).message]);
        } finally {
            setServerSyncing(false);
        }
    };

    const handleDiscovery = async () => {
        try {
            setServerSyncing(true);
            setErrors([]);

            const customPath = localStorage.getItem('lectro_server_path');
            const headers: HeadersInit = {};
            if (customPath) headers['x-library-path'] = customPath;

            const response = await fetch('/api/library/discovery', {
                method: 'POST',
                headers
            });

            if (!response.ok) throw new Error('Error al conectar con el servidor');

            const result = await response.json();

            if (result.success) {
                if (result.addedCount > 0) {
                    // Add to local DB
                    const { db } = await import('@/lib/db');
                    // We don't have full file blobs, just metadata pointing to server
                    // The 'scan' logic usually handles download, but here we just want to create the "Pointer" entry
                    // so the user sees it. Clicking it will trigger Reader which uses server path.

                    await db.transaction('rw', [db.books], async () => {
                        for (const book of result.addedBooks) {
                            // Check existence locally
                            const exists = await db.books.where('id').equals(book.id).count();
                            if (!exists) {
                                await db.books.add(book);
                            }
                        }
                    });

                    // Update UI
                    const { getAllBooks } = await import('@/lib/db');
                    const books = await getAllBooks();
                    useLibraryStore.getState().setBooks(books);

                    alert(`Sincronización completada. Se han encontrado y añadido ${result.addedCount} libros nuevos.`);
                    setTimeout(onClose, 500);

                } else {
                    alert('No se encontraron libros nuevos en las carpetas.');
                }
            } else {
                throw new Error(result.error || 'Error desconocido');
            }

        } catch (e) {
            console.error('Discovery error:', e);
            setErrors(['Error al sincronizar carpetas: ' + (e as Error).message]);
        } finally {
            setServerSyncing(false);
        }
    };

    const handleBatchClassify = async () => {
        try {
            setServerSyncing(true);
            setErrors([]);

            const { getAllBooks, updateBook: dbUpdateBook } = await import('@/lib/db');
            const { classifyBookCategories } = await import('@/lib/ai/classifier');

            const books = await getAllBooks();
            // Filter books without categories or with empty categories
            const booksToClassify = books.filter(b => {
                const cats = b.metadata?.categories || [];
                const manuals = b.metadata?.manualCategories || [];
                // Process if NO automatic tags exist (all current tags are manual, or no tags)
                const hasAuto = cats.some(c => !manuals.includes(c));
                return !hasAuto;
            });

            if (booksToClassify.length === 0) {
                alert('Todos los libros ya tienen etiquetas asignadas.');
                setServerSyncing(false);
                return;
            }

            let classified = 0;
            let skipped = 0;

            for (const book of booksToClassify) {
                try {
                    const result = await classifyBookCategories(
                        book.title,
                        book.author,
                        book.metadata?.description,
                        book.metadata?.subjects
                    );

                    if (result.categories.length > 0) {
                        // Merge with manual categories
                        const manualCats = book.metadata?.manualCategories || [];
                        const newCategories = Array.from(new Set([...manualCats, ...result.categories]));

                        await dbUpdateBook(book.id, {
                            metadata: { ...book.metadata, categories: newCategories }
                        });
                        classified++;
                    } else {
                        skipped++;
                    }
                } catch (e) {
                    console.error(`Failed to classify ${book.title}:`, e);
                    skipped++;
                }
            }

            // Refresh store
            const updatedBooks = await getAllBooks();
            useLibraryStore.getState().setBooks(updatedBooks);

            alert(`Clasificación completada:\n• ${classified} libros etiquetados\n• ${skipped} libros sin metadatos suficientes`);

        } catch (e) {
            console.error('Batch classify error:', e);
            setErrors(['Error al clasificar libros: ' + (e as Error).message]);
        } finally {
            setServerSyncing(false);
        }
    };

    // ... existing processFile ...

    const processFiles = async (files: File[]) => {
        const validFiles = files.filter(f => {
            const ext = f.name.split('.').pop()?.toLowerCase();
            return ext === 'epub' || ext === 'pdf';
        });

        if (validFiles.length === 0) {
            setErrors(['No se encontraron archivos EPUB o PDF válidos']);
            return;
        }

        setImporting(true);
        setProgress({ current: 0, total: validFiles.length });
        setErrors([]);

        const newErrors: string[] = [];

        for (let i = 0; i < validFiles.length; i++) {
            const file = validFiles[i];
            setProgress({ current: i + 1, total: validFiles.length });

            try {
                await processFile(file);
            } catch (error) {
                console.error(`Error importing ${file.name}:`, error);
                newErrors.push(`Error al importar "${file.name}": ${(error as Error).message}`);
            }
        }

        setImporting(false);
        setErrors(newErrors);

        if (newErrors.length === 0) {
            setTimeout(onClose, 500);
        }
    };

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFiles(e.dataTransfer.files);
        }
    }, [handleFiles]);

    const handleClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFiles(e.target.files);
        }
        // Reset input value to allow selecting the same file again
        if (e.target) {
            e.target.value = '';
        }
    };

    return (
        <div className="modal-overlay open" onClick={(e) => {
            if (e.target === e.currentTarget && !importing) onClose();
        }}>
            <div className="modal">
                <div className="modal-header">
                    <h2 className="modal-title">Administrar Biblioteca</h2>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        {!importing && !serverSyncing && (
                            <button className="btn btn-ghost btn-icon" onClick={onClose}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        )}
                    </div>
                </div>

                <div className="modal-body">
                    {/* ... permissions ... */}
                    {permissionRequired ? (
                        // ... existing permission block ...
                        <div className="permission-request">
                            {/* ... content ... */}
                        </div>
                    ) : importing ? (
                        // ... existing importing block ...
                        <div className="import-progress">
                            {/* ... content ... */}
                        </div>
                    ) : (
                        <>
                            {/* Drag & Drop Area */}
                            <div
                                className={`drop-zone ${isDragging ? 'active' : ''}`}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                onClick={handleClick}
                            >
                                {/* ... icon ... */}
                                <div className="drop-zone-icon">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                        <polyline points="17 8 12 3 7 8" />
                                        <line x1="12" y1="3" x2="12" y2="15" />
                                    </svg>
                                </div>
                                <p className="drop-zone-text">
                                    Importar Libros
                                </p>
                                <p className="drop-zone-hint">
                                    Arrastra EPUB/PDF o haz clic
                                </p>
                            </div>

                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".epub,.pdf"
                                multiple
                                onChange={handleFileChange}
                                style={{ display: 'none' }}
                            />
                        </>

                    )}

                    {serverSyncing && (
                        <div className="import-progress">
                            <div className="progress-spinner" />
                            <p className="progress-text">
                                Analizando integridad de la biblioteca...
                            </p>
                        </div>
                    )}

                    {!importing && !serverSyncing && !permissionRequired && (
                        <div className="server-sync-section">
                            <div className="divider">
                                <span>Mantenimiento</span>
                            </div>
                            <button className="btn btn-secondary btn-full btn-repair" onClick={handleMaintenance}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18" style={{ marginRight: '8px' }}>
                                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                                </svg>
                                Reparar Base de Datos
                            </button>
                            <p className="hint-text">Elimina libros "fantasma" que no tienen archivo asociado.</p>

                            <div className="divider" style={{ margin: '12px 0' }}></div>

                            <button className="btn btn-secondary btn-full btn-sync" onClick={handleDiscovery}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18" style={{ marginRight: '8px' }}>
                                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7" />
                                    <line x1="16" y1="5" x2="22" y2="5" />
                                    <line x1="19" y1="2" x2="19" y2="8" />
                                </svg>
                                Sincronizar Carpetas
                            </button>
                            <p className="hint-text">Busca y añade archivos copiados manualmente en la carpeta del servidor.</p>

                            <div className="divider" style={{ margin: '12px 0' }}></div>

                            <button className="btn btn-secondary btn-full btn-classify" onClick={handleBatchClassify}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18" style={{ marginRight: '8px' }}>
                                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                                    <line x1="7" y1="7" x2="7.01" y2="7" />
                                </svg>
                                Asignar Etiquetas Automáticas
                            </button>
                            <p className="hint-text">Clasifica automáticamente los libros sin etiqueta según sus metadatos.</p>
                        </div>
                    )}

                    {errors.length > 0 && (
                        <div className="import-errors">
                            {errors.map((error, i) => (
                                <p key={i} className="error-message">{error}</p>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <style jsx>{`
        .import-progress {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: var(--space-8);
        }

        .progress-spinner {
          width: 48px;
          height: 48px;
          border: 3px solid var(--color-border);
          border-top-color: var(--color-accent);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        .progress-text {
          margin-top: var(--space-4);
          color: var(--color-text-secondary);
        }

        .progress-bar {
          width: 100%;
          height: 4px;
          background: var(--color-bg-tertiary);
          border-radius: var(--radius-full);
          margin-top: var(--space-4);
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: var(--gradient-accent);
          transition: width var(--transition-base);
        }

        .import-errors {
          margin-top: var(--space-4);
          padding: var(--space-3);
          background: rgba(255, 69, 58, 0.1);
          border-radius: var(--radius-md);
        }

        .error-message {
          font-size: var(--text-sm);
          color: var(--color-error);
          margin-bottom: var(--space-2);
        }

        .error-message:last-child {
          margin-bottom: 0;
        }

        .permission-request {
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            padding: var(--space-8);
            gap: var(--space-4);
        }

        .permission-icon {
            color: var(--color-accent);
            margin-bottom: var(--space-2);
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
        </div >
    );
}

function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}
