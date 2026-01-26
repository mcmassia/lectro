import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getLibraryPath } from '@/lib/server/config';

// Function getLibraryPath removed (deprecated)


export async function GET(req: NextRequest) {
    try {
        const libraryPath = getLibraryPath();
        console.log(`[GET] Using library path: ${libraryPath}`);

        if (!libraryPath || !fs.existsSync(libraryPath)) {
            // Check if we should auto-create default?
            if (libraryPath.endsWith('/library') && !fs.existsSync(libraryPath)) {
                try {
                    fs.mkdirSync(libraryPath, { recursive: true });
                    console.log(`Created default library path: ${libraryPath}`);
                } catch (e) { /* ignore */ }
            } else {
                console.error(`Library path does not exist: ${libraryPath}`);
                return NextResponse.json({ error: `Library path not found: ${libraryPath}` }, { status: 404 });
            }
        }

        const dbPath = path.join(libraryPath, 'lectro_data.json');
        console.log(`[GET] Reading metadata from: ${dbPath}`);

        if (!fs.existsSync(dbPath)) {
            return NextResponse.json({
                books: [],
                tags: [],
                annotations: [],
                lastSync: new Date().toISOString()
            });
        }

        const data = fs.readFileSync(dbPath, 'utf8');
        return NextResponse.json(JSON.parse(data));

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

        const booksCount = body.books?.length || 0;
        console.log(`[POST] Received ${booksCount} books to merge.`);

        // Read existing data to merge
        let existingData: any = { books: [], tags: [], annotations: [], readingSessions: [] };
        if (fs.existsSync(dbPath)) {
            try {
                const fileContent = fs.readFileSync(dbPath, 'utf8');
                existingData = JSON.parse(fileContent);
            } catch (e) {
                console.error('Failed to parse existing metadata, starting fresh:', e);
            }
        }

        // Helper to check timestamps
        const getTime = (item: any) => {
            if (!item) return 0;
            return new Date(item.updatedAt || item.lastReadAt || item.createdAt || 0).getTime();
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

                        // Debug log for conflicts (only for books to avoid spam)
                        if (item.cover !== existingItem.cover) {
                            console.log(`[MERGE] Conflict for book ${item.title || key}:`);
                            console.log(`  Incoming Time: ${new Date(incomingTime).toISOString()} (${incomingTime})`);
                            console.log(`  Existing Time: ${new Date(existingTime).toISOString()} (${existingTime})`);
                            console.log(`  Winner: ${incomingTime >= existingTime ? 'Incoming' : 'Existing'}`);
                        }

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
            readingSessions: mergedSessions,
            users: mergedUsers,
            userBookData: mergedUserBookData,
            lastSync: new Date().toISOString()
        };

        fs.writeFileSync(dbPath, JSON.stringify(dataToSave, null, 2));

        return NextResponse.json({ success: true, timestamp: dataToSave.lastSync, mergedBooks: mergedBooks.length });

    } catch (error) {
        console.error('Error saving metadata FULL DETAILS:', error);
        return NextResponse.json({
            error: 'Failed to save metadata',
            details: (error as Error).message,
            stack: (error as Error).stack
        }, { status: 500 });
    }
}
