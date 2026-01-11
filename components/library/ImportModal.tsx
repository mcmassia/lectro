'use client';

import { useState, useCallback, useRef } from 'react';
import { v4 as uuid } from 'uuid';
import { Book, addBook as dbAddBook } from '@/lib/db';
import { useLibraryStore } from '@/stores/appStore';
import ePub from 'epubjs';

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

    const processEpub = async (file: File): Promise<Partial<Book>> => {
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
            title: metadata.title || file.name.replace(/\.epub$/i, ''),
            author: metadata.creator || 'Autor desconocido',
            cover: coverBase64,
            format: 'epub',
            totalPages: estimatedPages,
            metadata: {
                publisher: metadata.publisher,
                language: metadata.language,
                description: metadata.description,
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
            metadata: bookData.metadata || {},
            status: 'reading' // Default to reading for imported books
        };

        await dbAddBook(newBook);
        addBook(newBook);

        // Save to file system if configured
        try {
            console.log('Attempting to save to file system...');
            const { getSettings } = await import('@/lib/db');
            const { writeBookToFile, verifyPermission } = await import('@/lib/fileSystem');
            const settings = await getSettings();
            console.log('Settings retrieved. Handle exists:', !!settings.libraryHandle);

            if (settings.libraryHandle) {
                console.log('Verifying permission to write...');
                const hasPermission = await verifyPermission(settings.libraryHandle, true);
                console.log('Permission status:', hasPermission);

                if (hasPermission) {
                    await writeBookToFile(settings.libraryHandle, file);
                    console.log('File written to system folder:', file.name);
                    // alert(`Archivo guardado correctamente en: ${settings.libraryPath}`);
                } else {
                    console.warn('Permission denied for file system write');
                    alert('No se pudo guardar el archivo en la carpeta: Permiso denegado.');
                }
            } else {
                console.log('No library handle found in settings. Skipping write.');
            }
        } catch (e) {
            console.error('Failed to save to file system:', e);
            alert(`Error al guardar en la carpeta del sistema: ${(e as Error).message}`);
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
                    <h2 className="modal-title">Importar libros</h2>
                    {!importing && (
                        <button className="btn btn-ghost btn-icon" onClick={onClose}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    )}
                </div>

                <div className="modal-body">
                    {permissionRequired ? (
                        <div className="permission-request">
                            <div className="permission-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48">
                                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                                    <line x1="12" y1="11" x2="12" y2="17" />
                                    <line x1="9" y1="14" x2="15" y2="14" />
                                </svg>
                            </div>
                            <h3>Se requiere permiso</h3>
                            <p>Para guardar los libros en tu carpeta de biblioteca, necesitamos permiso de escritura.</p>
                            <button className="btn btn-primary" onClick={grantPermission}>
                                Conceder permiso
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={() => {
                                setPermissionRequired(false);
                                processFiles(pendingFiles);
                            }}>
                                Omitir (No guardar en carpeta)
                            </button>
                        </div>
                    ) : importing ? (
                        <div className="import-progress">
                            <div className="progress-spinner" />
                            <p className="progress-text">
                                Importando {progress.current} de {progress.total}...
                            </p>
                            <div className="progress-bar">
                                <div
                                    className="progress-fill"
                                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                                />
                            </div>
                        </div>
                    ) : (
                        <>
                            <div
                                className={`drop-zone ${isDragging ? 'active' : ''}`}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                onClick={handleClick}
                            >
                                <div className="drop-zone-icon">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                        <polyline points="17 8 12 3 7 8" />
                                        <line x1="12" y1="3" x2="12" y2="15" />
                                    </svg>
                                </div>
                                <p className="drop-zone-text">
                                    Arrastra tus archivos aquí
                                </p>
                                <p className="drop-zone-hint">
                                    o haz clic para seleccionar (EPUB, PDF)
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
        </div>
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
