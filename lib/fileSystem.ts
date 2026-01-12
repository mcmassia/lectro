import { db, Book, addBook, updateBook } from './db';
import { v4 as uuid } from 'uuid';
import ePub from 'epubjs';
import * as pdfjsLib from 'pdfjs-dist';

// Configurar el worker de PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

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
    size: number;
    modifiedTime: string;
}

export async function syncWithServer(): Promise<{ added: number; removed: number; errors: string[] }> {
    const addedCount = 0;
    const errors: string[] = [];

    try {
        // 1. Fetch list of files from server
        const customPath = localStorage.getItem('lectro_server_path');
        const headers: HeadersInit = {};
        if (customPath) {
            headers['x-library-path'] = customPath;
        }

        const response = await fetch('/api/library/scan', { headers });
        if (!response.ok) {
            throw new Error('Failed to scan server library');
        }
        const data = await response.json();
        const serverFiles: ServerFile[] = data.files || [];

        console.log('Server files found:', serverFiles.length);

        // 2. Process each file
        let added = 0;
        for (const fileInfo of serverFiles) {
            try {
                // Check uniqueness by fileName for now (could be improved)
                const existing = await db.books.where('fileName').equals(fileInfo.name).first();
                if (existing) {
                    continue; // Skip existing
                }

                console.log('Downloading from server:', fileInfo.name);
                const fileRes = await fetch(`/api/library/file/${encodeURIComponent(fileInfo.name)}`, { headers });
                if (!fileRes.ok) {
                    console.error('Failed to download:', fileInfo.name);
                    errors.push(`Failed to download ${fileInfo.name}`);
                    continue;
                }

                const blob = await fileRes.blob();
                // Create a File object from Blob to reuse existing logic if possible, 
                // or just pass to a helper. 
                // We'll mimic a File object since our logic often expects name/lastModified
                const file = new File([blob], fileInfo.name, {
                    type: fileInfo.name.endsWith('.epub') ? 'application/epub+zip' : 'application/pdf',
                    lastModified: new Date(fileInfo.modifiedTime).getTime()
                });

                // Reuse logic similar to processFileEntry but we don't have a Handle
                // We can extract the core logic of processFileEntry into a helper or just duplicate the minimal needed parts here.
                // Refactoring processFileEntry to share logic is cleaner.
                const book = await processFileBlob(file);

                if (book) {
                    await addBook(book);
                    added++;
                }

            } catch (err) {
                console.error('Error processing server file:', fileInfo.name, err);
                errors.push(`Error processing ${fileInfo.name}: ${(err as Error).message}`);
            }
        }

        // 3. Handle deletions
        const removed = await handleDeletions(serverFiles, errors);

        return { added, removed, errors };

    } catch (err) {
        console.error('Server sync failed:', err);
        throw err;
    }
}

async function handleDeletions(serverFiles: ServerFile[], errors: string[]): Promise<number> {
    let removed = 0;
    try {
        const localServerBooks = await db.books.filter(b => !!b.isOnServer).toArray();
        const serverFileNames = new Set(serverFiles.map(f => f.name));

        for (const book of localServerBooks) {
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
                    removed++;
                } catch (e) {
                    console.error('Failed to remove local book:', book.title, e);
                    errors.push(`Failed to remove ${book.title}`);
                }
            }
        }
    } catch (e) {
        console.error('Error handling deletions:', e);
    }
    return removed;
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
        status: 'planToRead',
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
