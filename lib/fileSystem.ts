import { db, Book, addBook } from './db';
import { v4 as uuid } from 'uuid';
import ePub from 'epubjs';

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
    const options: FileSystemHandlePermissionDescriptor = {
        mode: readWrite ? 'readwrite' : 'read'
    };
    return await fileHandle.queryPermission(options);
}

export async function verifyPermission(fileHandle: FileSystemDirectoryHandle, readWrite = false) {
    const options: FileSystemHandlePermissionDescriptor = {
        mode: readWrite ? 'readwrite' : 'read'
    };

    // Check if permission was already granted. If so, return true.
    if ((await fileHandle.queryPermission(options)) === 'granted') {
        return true;
    }

    // Request permission. If the user grants permission, return true.
    if ((await fileHandle.requestPermission(options)) === 'granted') {
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
