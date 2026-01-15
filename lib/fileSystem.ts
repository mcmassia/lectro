import { db, Book, addBook, updateBook } from './db';
import { v4 as uuid } from 'uuid';
import ePub from 'epubjs';

// Remove top-level pdfjs import to prevent SSR issues
// import * as pdfjsLib from 'pdfjs-dist';

// Configurar el worker de PDF.js
// pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

// Helper to get PDFjs on client side only
async function getPdfJs() {
    if (typeof window === 'undefined') return null;
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
    return pdfjsLib;
}

// Convert blob to base64
async function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// Process a file found in the directory
async function processFileEntry(fileHandle: FileSystemFileHandle): Promise<Book | null> {
    const file = await fileHandle.getFile();
    const extension = file.name.split('.').pop()?.toLowerCase();

    if (extension !== 'epub' && extension !== 'pdf') {
        return null;
    }

    // Check if book already exists by filename (simple check)
    const existingBooks = await db.books.where('fileName').equals(file.name).toArray();
    if (existingBooks.length > 0) {
        return null; // Skip existing
    }

    let bookData: Partial<Book> = {
        title: file.name,
        author: 'Unknown',
        format: extension as 'epub' | 'pdf',
    };

    if (extension === 'epub') {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const book = ePub(arrayBuffer);
            await book.ready;
            const metadata = await book.loaded.metadata;
            const coverUrl = await book.coverUrl();

            let coverBase64;
            if (coverUrl) {
                const response = await fetch(coverUrl);
                const blob = await response.blob();
                coverBase64 = await blobToBase64(blob);
            }

            bookData = {
                title: metadata.title || file.name.replace(/\.epub$/i, ''),
                author: metadata.creator || 'Autor desconocido',
                cover: coverBase64,
                format: 'epub',
                metadata: {
                    publisher: metadata.publisher,
                    language: metadata.language,
                    description: metadata.description,
                }
            };
            book.destroy();

            // Check if book exists by title to prevent duplicates
            // We do this after parsing to get the correct title
            const titleMatch = await db.books.where('title').equals(bookData.title!).first();
            if (titleMatch) {
                console.log('Found existing book by title, linking file:', bookData.title);
                await db.books.update(titleMatch.id, {
                    fileName: file.name,
                    fileSize: file.size,
                    // Optionally update cover/metadata if missing?
                    // For now, just link the file
                });
                return null; // Skip creation
            }
        } catch (e) {
            console.error('Error processing EPUB:', file.name, e);
        }
    }

    return {
        id: uuid(),
        title: bookData.title || file.name,
        author: bookData.author || 'Autor desconocido',
        cover: bookData.cover,
        format: bookData.format || 'epub',
        fileName: file.name,
        fileBlob: file,
        fileSize: file.size,
        addedAt: new Date(),
        progress: 0,
        currentPosition: '',
        totalPages: 0,
        metadata: bookData.metadata || {},
        status: 'planToRead'
    };
}

export async function checkPermission(fileHandle: FileSystemDirectoryHandle, readWrite = false): Promise<PermissionState> {
    const options = {
        mode: readWrite ? 'readwrite' : 'read'
    };
    return await (fileHandle as any).queryPermission(options);
}

export async function verifyPermission(fileHandle: FileSystemDirectoryHandle, readWrite = false) {
    const options = {
        mode: readWrite ? 'readwrite' : 'read'
    };

    // Check if permission was already granted. If so, return true.
    if ((await (fileHandle as any).queryPermission(options)) === 'granted') {
        return true;
    }

    // Request permission. If the user grants permission, return true.
    if ((await (fileHandle as any).requestPermission(options)) === 'granted') {
        return true;
    }

    // The user didn't grant permission, so return false.
    return false;
}

export async function syncLibraryWithFolder(dirHandle: FileSystemDirectoryHandle): Promise<number> {
    let addedCount = 0;
    console.log('Starting sync with folder:', dirHandle.name);

    try {
        // @ts-ignore
        for await (const entry of dirHandle.values()) {
            console.log('Found entry:', entry.name, entry.kind);
            if (entry.kind === 'file') {
                try {
                    const book = await processFileEntry(entry as FileSystemFileHandle);
                    if (book) {
                        console.log('Adding book:', book.title);
                        await addBook(book);
                        addedCount++;
                    } else {
                        console.log('Skipping file (invalid or duplicate):', entry.name);
                    }
                } catch (err) {
                    console.error('Error processing file:', entry.name, err);
                }
            }
        }
    } catch (err) {
        console.error('Error iterating directory:', err);
    }

    console.log('Sync complete. Added:', addedCount);
    return addedCount;
}

export interface ServerFile {
    name: string;
    relativePath?: string; // Added relative path support
    size: number;
    modifiedTime: string;
}

export async function syncWithServer(onProgress?: (log: string) => void): Promise<{ added: number; removed: number; errors: string[] }> {
    let added = 0;
    const errors: string[] = [];
    const log = (msg: string) => {
        console.log(msg);
        if (onProgress) onProgress(msg);
    };

    try {
        // 1. Fetch list of files from server
        log('Conectando con el servidor...');
        const customPath = localStorage.getItem('lectro_server_path');
        const headers: HeadersInit = {};
        if (customPath) {
            headers['x-library-path'] = customPath;
        }

        log('Escaneando archivos en el servidor...');
        const response = await fetch('/api/library/scan', { headers });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Failed to scan server library: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        const serverFiles: ServerFile[] = data.files || [];

        log(`Encontrados ${serverFiles.length} archivos en el servidor.`);

        // 2. Process each file
        let processed = 0;
        for (const fileInfo of serverFiles) {
            processed++;
            try {
                // Determine the correct identifier: prefer relativePath, fallback to name
                const currentPath = fileInfo.relativePath || fileInfo.name;

                // log(`Procesando (${processed}/${serverFiles.length}): ${currentPath}`); // Too verbose? no, good for debug context

                // Check uniqueness by filePath (new standard) OR fileName (legacy migration)
                let existing = await db.books.where('filePath').equals(currentPath).first();

                if (!existing && !fileInfo.relativePath) {
                    existing = await db.books.where('fileName').equals(fileInfo.name).first();
                } else if (!existing && fileInfo.relativePath) {
                    const potentialLegacy = await db.books.where('fileName').equals(fileInfo.name).first();
                    if (potentialLegacy && !potentialLegacy.filePath) {
                        existing = potentialLegacy;
                    }
                }

                if (existing) {
                    const updates: Partial<Book> = { isOnServer: true };

                    if (existing.filePath !== currentPath) {
                        // log(`Actualizando ruta: ${existing.title}`);
                        updates.filePath = currentPath;
                    }

                    if (!existing.isOnServer || existing.filePath !== currentPath) {
                        await db.books.update(existing.id, updates);
                    }
                    continue; // Skip download
                }

                log(`Descargando (${processed}/${serverFiles.length}): ${currentPath}`);

                // Use relativePath if available (for nested files), otherwise fallback to name
                let downloadUrl = `/api/library/file/${encodeURIComponent(fileInfo.name)}`;
                if (fileInfo.relativePath) {
                    // Use path param for nested files
                    downloadUrl += `?path=${encodeURIComponent(fileInfo.relativePath)}`;
                }

                const fileRes = await fetch(downloadUrl, { headers });

                if (!fileRes.ok) {
                    console.error('Failed to download:', currentPath);
                    errors.push(`Failed to download ${currentPath}`);
                    continue;
                }

                const blob = await fileRes.blob();
                const file = new File([blob], fileInfo.name, {
                    type: fileInfo.name.endsWith('.epub') ? 'application/epub+zip' : 'application/pdf',
                    lastModified: new Date(fileInfo.modifiedTime).getTime()
                });

                const book = await processFileBlob(file);

                if (book) {
                    book.filePath = currentPath;
                    await addBook(book);
                    added++;
                    // log(`Importado: ${book.title}`);
                }

            } catch (err) {
                console.error('Error processing server file:', fileInfo.name, err);
                errors.push(`Error processing ${fileInfo.name}: ${(err as Error).message}`);
            }
        }

        // 3. Handle deletions
        log('Verificando archivos eliminados...');
        const deletedIds = await handleDeletions(serverFiles, errors); // Returns string[]

        if (deletedIds.length > 0) {
            log(`Eliminando metadatos para ${deletedIds.length} libros...`);
            try {
                const customPath = localStorage.getItem('lectro_server_path');
                const syncHeaders: HeadersInit = { 'Content-Type': 'application/json' };
                if (customPath) syncHeaders['x-library-path'] = customPath;

                await fetch('/api/library/metadata', {
                    method: 'POST',
                    headers: syncHeaders,
                    body: JSON.stringify({
                        books: [], // No metadata update, just delete
                        lastSync: new Date().toISOString(),
                        deletedBookIds: deletedIds
                    })
                });
                log('Metadatos actualizados en el servidor.');
            } catch (err) {
                console.error('Failed to sync deletions to server:', err);
                errors.push('Failed to sync deletions to server metadata');
            }
        }

        const removed = deletedIds.length;
        log(`Sincronización completada. +${added} / -${removed}`);
        return { added, removed, errors };

    } catch (err) {
        console.error('Server sync failed:', err);
        throw err;
    }
}

async function handleDeletions(serverFiles: ServerFile[], errors: string[]): Promise<string[]> {
    const deletedIds: string[] = [];
    try {
        const localServerBooks = await db.books.filter(b => !!b.isOnServer).toArray();
        // Normalize server names for comparison (stripping accents if needed, though exact match preferred)
        // With the fuzzy logic on server, the server *should* have found the file if it existed.
        // If it's not in serverFiles, it's truly gone.
        const serverFileNames = new Set(serverFiles.map(f => f.name));

        for (const book of localServerBooks) {
            // Check if file exists in server listing
            // Note: serverFiles contains actual filenames on disk.
            // If book.fileName (from DB) doesn't match exactly, we might delete incorrectly if we don't fuzzy match here too.
            // But usually db.fileName should match what's on disk.
            // If the server performed a scan and returned "stripped" names, and DB has "full" names...
            // current check !serverFileNames.has(book.fileName) might be true even if file exists (mismatched name).
            // This is risky. But the user said "he borrado las carpetas", so they ARE gone.

            if (!serverFileNames.has(book.fileName)) {
                console.log('Removing local book not on server:', book.title);
                try {
                    await db.transaction('rw', [db.books, db.annotations, db.vectorChunks, db.xrayData, db.summaries], async () => {
                        await db.books.delete(book.id);
                        await db.annotations.where('bookId').equals(book.id).delete();
                        await db.vectorChunks.where('bookId').equals(book.id).delete();
                        await db.xrayData.where('bookId').equals(book.id).delete();
                        await db.summaries.where('bookId').equals(book.id).delete();
                    });
                    deletedIds.push(book.id);
                } catch (e) {
                    console.error('Failed to remove local book:', book.title, e);
                    errors.push(`Failed to remove ${book.title}`);
                }
            }
        }
    } catch (e) {
        console.error('Error handling deletions:', e);
    }
    return deletedIds;
}

// Reuse logic from processFileEntry but for a direct File object
async function processFileBlob(file: File): Promise<Book | null> {
    const extension = file.name.split('.').pop()?.toLowerCase();

    if (extension !== 'epub' && extension !== 'pdf') {
        return null;
    }

    // Double check DB (redundant but safe)
    const existingBooks = await db.books.where('fileName').equals(file.name).toArray();
    if (existingBooks.length > 0) {
        return null;
    }

    let bookData: Partial<Book> = {
        title: file.name,
        author: 'Unknown',
        format: extension as 'epub' | 'pdf',
    };

    if (extension === 'epub') {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const book = ePub(arrayBuffer);
            await book.ready;
            const metadata = await book.loaded.metadata;
            const coverUrl = await book.coverUrl();

            let coverBase64;
            if (coverUrl) {
                const response = await fetch(coverUrl);
                const blob = await response.blob();
                coverBase64 = await blobToBase64(blob);
            }

            bookData = {
                title: metadata.title || file.name.replace(/\.epub$/i, ''),
                author: metadata.creator || 'Autor desconocido',
                cover: coverBase64,
                format: 'epub',
                metadata: {
                    publisher: metadata.publisher,
                    language: metadata.language,
                    description: metadata.description,
                }
            };
            book.destroy();

            // Check title duplicate
            const titleMatch = await db.books.where('title').equals(bookData.title!).first();
            if (titleMatch) {
                // Link file to existing book entry if matching title found?
                // For now, let's just skip to avoid duplicates or overwrite?
                // The implementation in processFileEntry updates the filename.
                await db.books.update(titleMatch.id, {
                    fileName: file.name,
                    fileSize: file.size,
                });
                return null;
            }

        } catch (e) {
            console.error('Error processing EPUB blob:', file.name, e);
            // Return basic info if parsing fails? 
            // Better to return null or basic info. Let's return basic info so at least it appears.
        }
    } else if (extension === 'pdf') {
        // Generate PDF Thumbnail
        try {
            const pdfjsLib = await getPdfJs();
            if (pdfjsLib) {
                const arrayBuffer = await file.arrayBuffer();
                const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
                const pdf = await loadingTask.promise;
                const page = await pdf.getPage(1);

                const scale = 1.0;
                const viewport = page.getViewport({ scale });
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');

                if (context) {
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;

                    await page.render({
                        canvasContext: context,
                        viewport: viewport,
                        canvas: canvas as any // Cast to any to satisfy the type definition if needed
                    } as any).promise;

                    bookData.cover = canvas.toDataURL('image/jpeg', 0.8);
                }
            }
        } catch (e) {
            console.error('Error generating PDF thumbnail:', e);
        }
    }

    return {
        id: uuid(),
        title: bookData.title || file.name,
        author: bookData.author || 'Autor desconocido',
        cover: bookData.cover,
        format: bookData.format || 'epub',
        fileName: file.name,
        fileBlob: file,
        fileSize: file.size,
        addedAt: new Date(),
        progress: 0,
        currentPosition: '',
        totalPages: 0,
        metadata: bookData.metadata || {},
        status: 'unread',
        isOnServer: true // Since this function is used by syncWithServer
    };

}

export async function uploadBookToServer(book: Book): Promise<boolean> {
    try {
        const customPath = localStorage.getItem('lectro_server_path');
        const headers: HeadersInit = {};
        if (customPath) {
            headers['x-library-path'] = customPath;
        }

        // Add metadata headers for structured storage
        if (book.author) {
            headers['x-book-author'] = book.author;
        }
        if (book.title) {
            headers['x-book-title'] = book.title;
        }

        // 1. Get file blob from DB is not directly stored in 'books' table in full, 
        // usually we might need to re-fetch if we stored the handle, but here we likely have the binary 
        // or need to handle how the book data is accessible.
        // Assuming we have the file data or can get it. 
        // Wait, the current schema stores 'data' (ArrayBuffer) in 'books' table? 
        // Let's check db/index.ts. If it's just metadata, we might need the original file.
        // Actually, for imported books, we store the full ArrayBuffer in `book.data`.

        if (!book.fileBlob) {
            throw new Error('No book data available to upload');
        }

        const response = await fetch(`/api/library/file/${encodeURIComponent(book.fileName)}`, {
            method: 'POST',
            headers: {
                ...headers,
                'Content-Type': 'application/octet-stream'
            },
            body: book.fileBlob
        });

        if (!response.ok) {
            throw new Error('Upload failed');
        }

        // Update local book to mark as on server
        await updateBook(book.id, { isOnServer: true });

        return true;
    } catch (error) {
        console.error('Error uploading book:', error);
        throw error;
    }
}

export async function writeBookToFile(
    dirHandle: FileSystemDirectoryHandle,
    file: File
): Promise<void> {
    // Get a handle for the file, creating it if it doesn't exist
    const fileHandle = await dirHandle.getFileHandle(file.name, { create: true });

    // Create a writable stream to the file
    // @ts-ignore
    const writable = await fileHandle.createWritable();

    // Write the contents of the file to the stream
    await writable.write(file);

    // Close the file
    await writable.close();
}
