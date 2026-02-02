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
    getReadingSessionsForBook,
    getAllXRayData,
    saveXRayData,
    XRayData
} from './db';

interface ServerData {
    users: User[];
    userBookData: UserBookData[];
    books: Book[];
    tags: Tag[];
    annotations: Annotation[];
    readingSessions: ReadingSession[];
    xrayData: XRayData[];
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
        const localXRayData = await getAllXRayData();
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

        // 9. Merge X-Ray Data
        try {
            const incomingXRay = serverData.xrayData || [];
            if (incomingXRay.length > 0) {
                console.log(`[Sync] Merging ${incomingXRay.length} X-Ray items from server locally...`);
            }
            for (const sXRay of incomingXRay) {
                const lXRay = localXRayData.find(x => x.bookId === sXRay.bookId);

                if (!lXRay) {
                    await saveXRayData(hydrateXRayDates(sXRay));
                } else {
                    const sTime = getTime(sXRay.generatedAt);
                    const lTime = getTime(lXRay.generatedAt);
                    if (sTime > lTime) {
                        // Server is newer
                        await saveXRayData(hydrateXRayDates(sXRay));
                    }
                }
            }
        } catch (e) {
            console.error('[SYNC] Error merging X-Ray Data:', e);
        }

        // 9. Push merged state back to server
        // RE-ENABLED (Delta Sync): Only pushing changes
        const lastSyncTime = localStorage.getItem('lectro_last_sync');
        await pushLocalData(lastSyncTime ? new Date(lastSyncTime) : undefined);

        // Update last sync time
        localStorage.setItem('lectro_last_sync', new Date().toISOString());

        return { success: true, message: 'Sync complete' };

    } catch (error) {
        console.error('Sync failed:', error);
        return { success: false, message: (error as Error).message };
    }
}

export async function pushLocalData(lastSync?: Date) {
    const allBooks = await getAllBooksIncludingDeleted();
    // Delta Filter
    const books = lastSync ? allBooks.filter(b => !b.updatedAt || new Date(b.updatedAt) > lastSync) : allBooks;

    // If no lastSync (first run), and we have many books, this might be heavy.
    // But if server sent us books, we verified in syncData logic so maybe we skip?
    // For now, let's assume if it is a delta, it's small.

    const tags = await getAllTags();
    const modifiedTags = lastSync ? tags.filter(t => !t.updatedAt || new Date(t.updatedAt) > lastSync) : tags;

    const annotations = await getAllAnnotationsIncludingDeleted();
    const modifiedAnnotations = lastSync ? annotations.filter(a => !a.updatedAt || new Date(a.updatedAt) > lastSync) : annotations;

    const readingSessions = await db.readingSessions.toArray();
    // Sessions filter?? They are immutable mostly? 
    // Assuming sessions don't change much, but valid validation needed.
    // Let's blindly sync all sessions if small? Or filter by date? Session has no updatedAt?
    // Assuming adding session only.

    const users = await db.users.toArray();
    const modifiedUsers = lastSync ? users.filter(u => !u.updatedAt || new Date(u.updatedAt) > lastSync) : users;

    const userBookData = await db.userBookData.toArray();
    const modifiedUserBookData = lastSync ? userBookData.filter(d => !d.updatedAt || new Date(d.updatedAt) > lastSync) : userBookData;

    const xrayData = await getAllXRayData();
    // X-Ray data is shared across all users (book-level), so sync all of it
    const modifiedXray = lastSync
        ? xrayData.filter(x => !x.generatedAt || new Date(x.generatedAt) > lastSync)
        : xrayData;

    console.log(`[Sync] Pushing changes: ${books.length} books, ${modifiedAnnotations.length} annotations, ${modifiedXray.length} X-Ray items...`);

    if (books.length === 0 && modifiedTags.length === 0 && modifiedAnnotations.length === 0 && modifiedUserBookData.length === 0 && modifiedXray.length === 0) {
        console.log('[Sync] No local changes to push.');
        return;
    }

    // Re-attach covers for the books we are pushing!
    const booksWithCovers = await Promise.all(books.map(async (b) => {
        const cover = await db.covers.get(b.id);
        if (cover) return { ...b, cover: cover.coverBlob };
        return b;
    }));

    // Chunking
    const chunkArray = (arr: any[], size: number) => {
        const chunks = [];
        for (let i = 0; i < arr.length; i += size) {
            chunks.push(arr.slice(i, i + size));
        }
        return chunks;
    };

    // Strip blobs (fileBlob is already stripped by getAllBooks return type effectively, but ensure no fileBlob if checking raw)
    const booksPayload = booksWithCovers.map(b => {
        const { fileBlob, ...rest } = b;
        return rest;
    });

    const BATCH_SIZE = 50; // Smaller batch for covers
    const chunks = chunkArray(booksPayload, BATCH_SIZE);

    // Prepare headers
    const customPath = localStorage.getItem('lectro_server_path');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (customPath) headers['x-library-path'] = customPath;

    if (chunks.length === 0) chunks.push([]); // Ensure at least one push for other metadata

    for (let i = 0; i < chunks.length; i++) {
        const isLastChunk = i === chunks.length - 1;
        const chunk = chunks[i];

        const payload = {
            books: chunk,
            tags: isLastChunk ? modifiedTags : [],
            annotations: isLastChunk ? modifiedAnnotations : [],
            readingSessions: isLastChunk ? readingSessions : [],
            users: isLastChunk ? modifiedUsers : [],
            userBookData: isLastChunk ? modifiedUserBookData : [],
            xrayData: isLastChunk ? modifiedXray : [], // Sync X-Ray data for all users
        };

        const res = await fetch('/api/library/metadata', {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
        });

        if (!res.ok) console.error('Failed to push batch', i, res.statusText);
    }
}


// Helpers to ensure Dates are Dates (JSON returns strings)

function getTime(date?: Date | string): number {
    if (!date) return 0;
    return new Date(date).getTime();
}

function hydrateBookDates(book: any): Book {
    // STRIP USER SPECIFIC FIELDS from Book Object
    // These should only exist in UserBookData to prevent "fossilized" progress overwriting actual progress during sync
    const { progress, currentPage, currentPosition, lastReadAt, status, ...cleanBook } = book;

    return {
        ...cleanBook,
        addedAt: new Date(book.addedAt),
        updatedAt: book.updatedAt ? new Date(book.updatedAt) : undefined,
        // Remove lastReadAt from here entirely, it belongs in UserBookData
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


function hydrateXRayDates(data: any): XRayData {
    return {
        ...data,
        generatedAt: new Date(data.generatedAt)
    };
}

export async function syncVectors(): Promise<{ success: boolean; message: string }> {
    try {
        console.log('[Sync] Starting vector sync...');
        const customPath = localStorage.getItem('lectro_server_path');
        const headers: HeadersInit = {};
        if (customPath) headers['x-library-path'] = customPath;

        // 1. Pull Server Vectors
        const res = await fetch('/api/library/vectors', { headers });
        if (!res.ok) throw new Error('Failed to fetch vectors');

        const serverData = await res.json();
        const serverChunks = serverData.chunks || [];
        console.log(`[Sync] Received ${serverChunks.length} vector chunks from server.`);

        if (serverChunks.length > 0) {
            await db.transaction('rw', db.vectorChunks, async () => {
                await db.vectorChunks.bulkPut(serverChunks);
            });
            console.log('[Sync] Merged server vectors into local DB.');
        }

        // 2. Push Local Vectors
        const localChunks = await db.vectorChunks.toArray();
        if (localChunks.length > 0) {
            console.log(`[Sync] Pushing ${localChunks.length} local chunks to server...`);

            // Chunk payload to avoid request size limits
            const BATCH_SIZE = 500;
            const chunks = [];
            for (let i = 0; i < localChunks.length; i += BATCH_SIZE) {
                chunks.push(localChunks.slice(i, i + BATCH_SIZE));
            }

            for (let i = 0; i < chunks.length; i++) {
                const batch = chunks[i];
                console.log(`[Sync] Uploading vector batch ${i + 1}/${chunks.length}`);
                const pushRes = await fetch('/api/library/vectors', {
                    method: 'POST',
                    headers: { ...headers, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chunks: batch
                    })
                });
                if (!pushRes.ok) console.error('Failed to push vector batch', i);
            }
            console.log('[Sync] Vector push complete.');
        }

        return { success: true, message: 'Vector sync complete' };

    } catch (e: any) {
        console.error('[Sync] Vector sync failed:', e);
        return { success: false, message: e.message };
    }
}

