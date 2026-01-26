import {
    db,
    Book,
    Tag,
    Annotation,
    ReadingSession,
    User,
    UserBookData,
    getAllBooks,
    getAllBooksIncludingDeleted,
    getAllTags,
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
    users: User[];
    userBookData: UserBookData[];
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
        if ((!serverData.books || serverData.books.length === 0) && (!serverData.users || serverData.users.length === 0)) {
            console.log('Server library empty, forcing push of local data...');
            await pushLocalData();
            return { success: true, message: 'Initial push complete' };
        }

        // 2. Load all local data
        const localBooks = await getAllBooks();
        const localTags = await getAllTags();
        const localAnnotations = await getAllAnnotationsIncludingDeleted();
        const localSessions = await db.readingSessions.toArray();
        const localUsers = await db.users.toArray();
        const localUserBookData = await db.userBookData.toArray();

        // 3. Merge Users
        // Ideally we want to prevent overwriting current user session if possible, but data consistency is key
        for (const sUser of (serverData.users || [])) {
            const lUser = localUsers.find(u => u.id === sUser.id);
            const lUserByName = localUsers.find(u => u.username === sUser.username);

            if (lUser) {
                const sTime = getTime(sUser.updatedAt) || getTime(sUser.createdAt);
                const lTime = getTime(lUser.updatedAt) || getTime(lUser.createdAt);
                if (sTime > lTime) {
                    await db.users.put(hydrateUserDates(sUser));
                }
            } else if (lUserByName) {
                // Name match but ID different. Server wins to unify IDs.
                // Delete the local user with old ID, then put the server user
                await db.users.delete(lUserByName.id);
                await db.users.put(hydrateUserDates(sUser));
            } else {
                // New user - use put to handle any unexpected duplicates
                await db.users.put(hydrateUserDates(sUser));
            }
        }

        // 4. Merge UserBookData (Progress, Status)
        try {
            for (const sData of (serverData.userBookData || [])) {
                // Find by composite key: userId + bookId
                const lData = localUserBookData.find(d => d.userId === sData.userId && d.bookId === sData.bookId);

                if (lData) {
                    const sTime = getTime(sData.updatedAt);
                    const lTime = getTime(lData.updatedAt);
                    if (sTime > lTime) {
                        await db.userBookData.put({ ...hydrateUserBookDates(sData), id: lData.id });
                    }
                } else {
                    const { id, ...rest } = sData; // Drop ID to allow clean insert/update
                    // Hydrate and find existing ID to update or add new
                    const existing = await db.userBookData.where('[userId+bookId]').equals([sData.userId, sData.bookId]).first();
                    if (existing) {
                        await db.userBookData.put({ ...hydrateUserBookDates(rest), id: existing.id! });
                    } else {
                        // Use put instead of add to be safe, though without ID it generally adds
                        await db.userBookData.put(hydrateUserBookDates(rest) as any);
                    }
                }
            }
        } catch (e) {
            console.error('[SYNC] Error merging UserBookData:', e);
        }

        // 5. Merge Books
        try {
            for (const sBook of (serverData.books || [])) {
                const lBook = localBooks.find(b => b.id === sBook.id);

                if (!lBook) {
                    // New book from server
                    await db.books.put(hydrateBookDates(sBook));
                } else {
                    // Conflict resolution
                    const sTime = getTime(sBook.updatedAt) || getTime(sBook.lastReadAt) || 0;
                    const lTime = getTime(lBook.updatedAt) || getTime(lBook.lastReadAt) || 0;

                    if (sTime > lTime) {
                        // Server is newer
                        await updateBook(lBook.id, hydrateBookDates(sBook));
                    }
                }
            }
        } catch (e) {
            console.error('[SYNC] Error merging Books:', e);
        }

        // 6. Merge Tags
        try {
            for (const sTag of (serverData.tags || [])) {
                const lTag = localTags.find(t => t.id === sTag.id);
                const lTagName = localTags.find(t => t.name === sTag.name);

                if (lTag) {
                    const sTime = getTime(sTag.updatedAt) || getTime(sTag.createdAt);
                    const lTime = getTime(lTag.updatedAt) || getTime(lTag.createdAt);

                    if (sTime > lTime) {
                        await db.tags.put(hydrateTagDates(sTag));
                    }
                } else if (lTagName) {
                    // Same name but different ID. Server authority wins.
                    await db.tags.delete(lTagName.id);
                    await db.tags.put(hydrateTagDates(sTag));
                } else {
                    await db.tags.put(hydrateTagDates(sTag));
                }
            }
        } catch (e) {
            console.error('[SYNC] Error merging Tags:', e);
        }

        // 7. Merge Annotations (respecting soft deletes)
        // Get default user ID for legacy annotations without userId
        const defaultUser = await db.users.where('username').equals('mcmassia').first();
        const defaultUserId = defaultUser?.id;

        for (const sAnn of (serverData.annotations || [])) {
            const lAnn = localAnnotations.find(a => a.id === sAnn.id);

            // Assign default userId to legacy annotations without one
            let processedAnn = hydrateAnnotationDates(sAnn);
            if (!processedAnn.userId && defaultUserId) {
                processedAnn = { ...processedAnn, userId: defaultUserId };
                console.log(`[Sync] Assigned userId to legacy annotation ${sAnn.id}`);
            }

            if (!lAnn) {
                // Only add if not deleted
                if (!sAnn.deletedAt) {
                    await db.annotations.put(processedAnn);
                }
            } else {
                const sTime = getTime(sAnn.updatedAt);
                const lTime = getTime(lAnn.updatedAt);
                // Server is newer
                if (sTime > lTime) {
                    await db.annotations.update(lAnn.id, processedAnn as any);
                }
                // If local is deleted but server is not, keep local deletion (local wins if same time or newer)
            }
        }

        // 8. Merge Reading Sessions
        for (const sSession of (serverData.readingSessions || [])) {
            const lSession = localSessions.find(s => s.id === sSession.id);
            if (!lSession) {
                await db.readingSessions.put(hydrateSessionDates(sSession));
            }
        }

        // 9. Push merged state back to server
        // We always push the final state to ensure server is strictly consistent with the latest merge.

        await pushLocalData();

        return { success: true, message: 'Sync complete' };

    } catch (error) {
        console.error('Sync failed:', error);
        return { success: false, message: (error as Error).message };
    }
}

export async function pushLocalData() {
    const books = await getAllBooksIncludingDeleted();
    const tags = await getAllTags();
    // Include deleted annotations so server knows about deletions
    const annotations = await getAllAnnotationsIncludingDeleted();
    const readingSessions = await db.readingSessions.toArray();

    // New: Sync Users and User Metadata
    const users = await db.users.toArray();
    const userBookData = await db.userBookData.toArray();

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

    // Strip blobs to reduce payload. 
    // We MUST preserve 'cover' (base64) even if book is on server, because secondary devices 
    // syncing metadata might not have the physical file to serve the cover via API.
    const booksPayload = books.map(b => {
        const { fileBlob, ...rest } = b;
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
            users: isLastChunk ? users : [],
            userBookData: isLastChunk ? userBookData : [],
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

function hydrateSessionDates(session: any): ReadingSession {
    return {
        ...session,
        startTime: new Date(session.startTime),
        endTime: new Date(session.endTime)
    };
}

function hydrateUserDates(user: any): User {
    return {
        ...user,
        createdAt: new Date(user.createdAt),
        updatedAt: user.updatedAt ? new Date(user.updatedAt) : undefined
    };
}

function hydrateUserBookDates(data: any): UserBookData {
    return {
        ...data,
        updatedAt: new Date(data.updatedAt),
        lastReadAt: data.lastReadAt ? new Date(data.lastReadAt) : undefined
    };
}
