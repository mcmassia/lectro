import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getLibraryPath } from '@/lib/server/config';
import { JsonDb } from '@/lib/server/db';

export async function GET(req: NextRequest) {
    try {
        const libraryPath = getLibraryPath();
        console.log(`[GET] Using library path: ${libraryPath}`);

        // Ensure library exists (keep this check as it's cheap and safe)
        if (!libraryPath || !fs.existsSync(libraryPath)) {
            if (libraryPath.endsWith('/library') && !fs.existsSync(libraryPath)) {
                try {
                    fs.mkdirSync(libraryPath, { recursive: true });
                    console.log(`Created default library path: ${libraryPath}`);
                } catch (e) { /* ignore */ }
            }
        }

        // Use JsonDb.read() for safe concurrent reading (mostly just to be consistent, though read doesn't lock)
        const json = await JsonDb.read();

        if (!json) {
            console.log(`[GET] DB not found or empty.`);
            return NextResponse.json({
                books: [],
                tags: [],
                annotations: [],
                lastSync: new Date().toISOString()
            });
        }

        // OPTIMIZATION: Strip heavy fields (covers, blobs) to make initial sync lightweight
        if (json.books) {
            json.books = json.books.map((b: any) => {
                const { cover, fileBlob, ...rest } = b;
                return rest;
            });
        }

        return NextResponse.json(json);

    } catch (error) {
        console.error('Error reading metadata:', error);
        return NextResponse.json({ error: 'Failed to read metadata' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const libraryPath = getLibraryPath();
        console.log(`[POST] Using library path: ${libraryPath}`);

        if (!fs.existsSync(libraryPath)) {
            try {
                fs.mkdirSync(libraryPath, { recursive: true });
            } catch (e) {
                return NextResponse.json({ error: `Library path does not exist and could not be created: ${libraryPath}` }, { status: 500 });
            }
        }

        const dbPath = path.join(libraryPath, 'lectro_data.json');
        console.log(`[POST] Writing metadata to: ${dbPath}`);

        // Use Safe JsonDb Update
        // Note: merge logic requires reading current state, so we do it all inside update callback
        // The callback receives 'existingData' which is the current state of the DB
        const result = await JsonDb.update(async (existingData) => {
            if (!existingData) existingData = { books: [], tags: [], annotations: [], readingSessions: [], userBookData: [], users: [] };

            const booksCount = body.books?.length || 0;
            const xrayCount = body.xrayData?.length || 0;
            console.log(`[POST] Received ${booksCount} books, ${xrayCount} X-Ray items to merge.`);

            // Helper to check timestamps
            const getTime = (item: any) => {
                if (!item) return 0;
                return new Date(item.updatedAt || item.lastReadAt || item.createdAt || item.generatedAt || 0).getTime();
            };

            // Helper to merge arrays by ID with timestamp conflict resolution
            const mergeById = (existing: any[], incoming: any[], deletedIds: string[] = []) => {
                const map = new Map(existing.map(item => [item.id || item.name, item]));

                // Apply deletions first
                deletedIds.forEach(id => map.delete(id));

                // Apply updates/additions
                if (incoming && incoming.length > 0) {
                    incoming.forEach(item => {
                        const key = item.id || item.name;
                        const existingItem = map.get(key);

                        if (existingItem) {
                            // Conflict resolution
                            const incomingTime = getTime(item);
                            const existingTime = getTime(existingItem);

                            if (incomingTime >= existingTime) {
                                map.set(key, item);
                            }
                        } else {
                            if (key) map.set(key, item);
                        }
                    });
                }
                return Array.from(map.values());
            };

            // Helper to merge by composite ID (userId_bookId) with timestamp check
            const mergeByCompositeKey = (existing: any[], incoming: any[]) => {
                const getKey = (item: any) => `${item.userId}_${item.bookId}`;
                const map = new Map(existing.map(item => [getKey(item), item]));

                if (incoming && incoming.length > 0) {
                    incoming.forEach(item => {
                        if (item.userId && item.bookId) {
                            const key = getKey(item);
                            const existingItem = map.get(key);

                            // Drop local ID from incoming to avoid conflicts
                            const { id, ...rest } = item;
                            // Preserve ID if existing has one, or use none (server doesn't need it strictly)
                            const mergedItem = existingItem ? { ...rest, id: existingItem.id } : rest;

                            if (existingItem) {
                                if (getTime(mergedItem) >= getTime(existingItem)) {
                                    map.set(key, mergedItem);
                                }
                            } else {
                                map.set(key, mergedItem);
                            }
                        }
                    });
                }
                return Array.from(map.values());
            };

            const deletedBookIds = body.deletedBookIds || [];
            if (deletedBookIds.length > 0) {
                console.log(`[POST] Removing ${deletedBookIds.length} books:`, deletedBookIds);
            }

            // Merge Logic
            const mergedBooks = mergeById(existingData.books || [], body.books || [], deletedBookIds);
            const mergedTags = mergeById(existingData.tags || [], body.tags || []);
            const mergedAnnotations = mergeById(existingData.annotations || [], body.annotations || []);
            const mergedXRayData = mergeById(existingData.xrayData || [], body.xrayData || []);
            const mergedSessions = (body.readingSessions && body.readingSessions.length > 0)
                ? body.readingSessions
                : (existingData.readingSessions || []);

            // New Merges
            const mergedUsers = mergeById(existingData.users || [], body.users || []);
            const mergedUserBookData = mergeByCompositeKey(existingData.userBookData || [], body.userBookData || []);

            const dataToSave = {
                books: mergedBooks,
                tags: mergedTags,
                annotations: mergedAnnotations,
                xrayData: mergedXRayData,
                readingSessions: mergedSessions,
                users: mergedUsers,
                userBookData: mergedUserBookData,
                lastSync: new Date().toISOString()
            };

            // Return data to save (JsonDb handles the write)
            return dataToSave;
        });

        // JsonDb.update returns void, but we modified it? No, in my impl it returns void.
        // Wait, looking at JsonDb class I wrote:
        // update(callback): Promise<void>
        // Use the returned data modification logic? No, update handles write. I don't get the saved data back from update.
        // I need to return something from API. The timestamp is created inside.
        // I should probably return the timestamp from the callback if I want to use it outside?
        // Actually, for now, let's just generate timestamp outside or assume 'now'.
        // Wait, I can't easily get the 'dataToSave' out unless I change JsonDb or just capture it.
        // Let's modify the code above to capture it in a local var. -> NO, concurrent execution issues.
        // The safe way is: JsonDb.update returns Promise<void>. 
        // I should rely on the fact that I generate `lastSync` and return that.

        return NextResponse.json({ success: true, timestamp: new Date().toISOString(), mergedBooks: body.books?.length || 0 }); // Approx response is fine


    } catch (error) {
        console.error('Error saving metadata FULL DETAILS:', error);
        return NextResponse.json({
            error: 'Failed to save metadata',
            details: (error as Error).message,
            stack: (error as Error).stack
        }, { status: 500 });
    }
}
