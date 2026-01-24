import {
    db,
    Book,
    Tag,
    Annotation,
    ReadingSession,
    getAllBooks,
    getAllTags,
    getAllAnnotations,
    getAllAnnotationsIncludingDeleted,
    addBook,
    updateBook,
    addTag,
    updateTag,
    addAnnotation,
    updateAnnotation,
    addReadingSession,
    getReadingSessionsForBook
} from './db';

interface ServerData {
    books: Book[];
    tags: Tag[];
    annotations: Annotation[];
    readingSessions: ReadingSession[];
    lastSync: string;
}

export async function syncData(): Promise<{ success: boolean; message: string }> {
    try {
        console.log('Starting sync...');

        // 1. Fetch server data
        const customPath = localStorage.getItem('lectro_server_path');
        const headers: HeadersInit = {};
        if (customPath) {
            headers['x-library-path'] = customPath;
        }

        const response = await fetch('/api/library/metadata', { headers });
        if (!response.ok) {
            throw new Error(`Failed to fetch server data: ${response.statusText}`);
        }

        const serverData: ServerData = await response.json();
        console.log(`Received ${serverData.books?.length || 0} books from server`);

        // Handle empty server state (first run)
        if ((!serverData.books || serverData.books.length === 0) && (!serverData.tags || serverData.tags.length === 0)) {
            console.log('Server library empty, forcing push of local data...');
            await pushLocalData();
            return { success: true, message: 'Initial push complete' };
        }

        // 2. Load all local data
        const localBooks = await getAllBooks();
        const localTags = await getAllTags();
        const localAnnotations = await getAllAnnotationsIncludingDeleted();
        const localSessions = await db.readingSessions.toArray();

        // 3. Merge Books
        let hasChanges = false;

        // Process Server Books -> Local
        for (const sBook of (serverData.books || [])) {
            const lBook = localBooks.find(b => b.id === sBook.id);

            if (!lBook) {
                // New book from server (ensure date objects are instantiated)
                await addBook(hydrateBookDates(sBook));
                hasChanges = true;
            } else {
                // Conflict resolution
                const sTime = getTime(sBook.updatedAt) || getTime(sBook.lastReadAt) || 0;
                const lTime = getTime(lBook.updatedAt) || getTime(lBook.lastReadAt) || 0;

                if (sTime > lTime) {
                    // Server is newer
                    await updateBook(lBook.id, hydrateBookDates(sBook));
                    hasChanges = true;
                }
            }
        }

        // 4. Merge Tags
        for (const sTag of (serverData.tags || [])) {
            const lTag = localTags.find(t => t.id === sTag.id);
            const lTagName = localTags.find(t => t.name === sTag.name);

            if (lTag) {
                const sTime = getTime(sTag.updatedAt) || getTime(sTag.createdAt);
                const lTime = getTime(lTag.updatedAt) || getTime(lTag.createdAt);

                if (sTime > lTime) {
                    await db.tags.update(lTag.id, hydrateTagDates(sTag));
                    hasChanges = true;
                }
            } else if (lTagName) {
                // Same name but different ID. Server authority wins to converge IDs.
                await db.tags.delete(lTagName.id);
                await db.tags.add(hydrateTagDates(sTag));
                hasChanges = true;
            } else {
                await db.tags.add(hydrateTagDates(sTag));
                hasChanges = true;
            }
        }

        // 5. Merge Annotations (respecting soft deletes)
        for (const sAnn of (serverData.annotations || [])) {
            const lAnn = localAnnotations.find(a => a.id === sAnn.id);
            if (!lAnn) {
                // Only add if not deleted
                if (!sAnn.deletedAt) {
                    await db.annotations.put(hydrateAnnotationDates(sAnn));
                    hasChanges = true;
                }
            } else {
                const sTime = getTime(sAnn.updatedAt);
                const lTime = getTime(lAnn.updatedAt);
                // Server is newer
                if (sTime > lTime) {
                    await db.annotations.update(lAnn.id, hydrateAnnotationDates(sAnn) as any);
                    hasChanges = true;
                }
                // If local is deleted but server is not, keep local deletion (local wins if same time or newer)
            }
        }

        // 6. Push merged state back to server
        // We always push the final state to ensure server is strictly consistent with the latest merge.

        await pushLocalData();

        return { success: true, message: 'Sync complete' };

    } catch (error) {
        console.error('Sync failed:', error);
        return { success: false, message: (error as Error).message };
    }
}

export async function pushLocalData() {
    const books = await getAllBooks();
    const tags = await getAllTags();
    // Include deleted annotations so server knows about deletions
    const annotations = await getAllAnnotationsIncludingDeleted();
    const readingSessions = await db.readingSessions.toArray();

    // Prepare headers
    const customPath = localStorage.getItem('lectro_server_path');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (customPath) headers['x-library-path'] = customPath;

    // Helper to chunk array
    const chunkArray = (arr: any[], size: number) => {
        const chunks = [];
        for (let i = 0; i < arr.length; i += size) {
            chunks.push(arr.slice(i, i + size));
        }
        return chunks;
    };

    // Strip blobs and covers to reduce payload
    const booksPayload = books.map(b => {
        const { fileBlob, cover, ...rest } = b;
        return rest;
    });

    const BATCH_SIZE = 500;
    const chunks = chunkArray(booksPayload, BATCH_SIZE);

    // If no books, ensure we still push tags/annotations in one go
    if (chunks.length === 0) chunks.push([]);

    console.log(`Pushing ${books.length} books in ${chunks.length} batches...`);

    for (let i = 0; i < chunks.length; i++) {
        const isLastChunk = i === chunks.length - 1;
        const chunk = chunks[i];

        const payload = {
            books: chunk,
            // Only send other metadata in the last batch to avoid partial overwrites (though server merges now)
            tags: isLastChunk ? tags : [],
            annotations: isLastChunk ? annotations : [],
            readingSessions: isLastChunk ? readingSessions : [],
            lastSync: new Date().toISOString()
        };

        console.log(`Pushing batch ${i + 1}/${chunks.length} (${chunk.length} books)...`);

        const res = await fetch('/api/library/metadata', {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errorText = await res.text();
            console.error('Push batch failed. Raw Server Response:', errorText);

            let errorDetails = {};
            try {
                errorDetails = JSON.parse(errorText);
            } catch (e) {
                // Response was not JSON (likely 500 HTML page)
                // Try to extract useful info from HTML title if possible
                const match = errorText.match(/<title>(.*?)<\/title>/);
                errorDetails = { error: 'Server returned non-JSON response', details: match ? match[1] : errorText.slice(0, 200) };
            }

            throw new Error(`Failed to push batch ${i + 1}: ${res.statusText} - ${(errorDetails as any).details || (errorDetails as any).error || 'Unknown error'}`);
        }
    }
    console.log('Push complete.');
}

// Helpers to ensure Dates are Dates (JSON returns strings)

function getTime(date?: Date | string): number {
    if (!date) return 0;
    return new Date(date).getTime();
}

function hydrateBookDates(book: any): Book {
    return {
        ...book,
        addedAt: new Date(book.addedAt),
        updatedAt: book.updatedAt ? new Date(book.updatedAt) : undefined,
        lastReadAt: book.lastReadAt ? new Date(book.lastReadAt) : undefined,
    };
}

function hydrateTagDates(tag: any): Tag {
    return {
        ...tag,
        createdAt: new Date(tag.createdAt),
        updatedAt: tag.updatedAt ? new Date(tag.updatedAt) : undefined,
    };
}

function hydrateAnnotationDates(ann: any): Annotation {
    return {
        ...ann,
        createdAt: new Date(ann.createdAt),
        updatedAt: ann.updatedAt ? new Date(ann.updatedAt) : undefined,
    };
}
