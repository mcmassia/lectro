import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const CONFIG_FILE = path.join(process.cwd(), 'server-config.json');

function getLibraryPath(): string {
    if (process.env.LECTRO_LIBRARY_PATH) return process.env.LECTRO_LIBRARY_PATH;
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
            if (config.libraryPath) return config.libraryPath;
        }
    } catch (e) { }
    return path.join(process.cwd(), 'library');
}

export async function POST(req: NextRequest) {
    try {
        const { bookId, userId, cfi, progress, totalPages, currentPage } = await req.json();

        if (!bookId || !cfi) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const libraryPath = getLibraryPath();
        const dbPath = path.join(libraryPath, 'lectro_data.json');

        if (!fs.existsSync(dbPath)) {
            return NextResponse.json({ error: 'Library DB not found' }, { status: 404 });
        }

        // Read DB
        const fileContent = fs.readFileSync(dbPath, 'utf8');
        const data = JSON.parse(fileContent);
        const now = new Date().toISOString();

        if (userId) {
            // Update User-Specific Data (UserBookData)
            if (!data.userBookData) data.userBookData = [];

            const userBookIndex = data.userBookData.findIndex((d: any) => d.userId === userId && d.bookId === bookId);

            if (userBookIndex !== -1) {
                // Update existing
                data.userBookData[userBookIndex] = {
                    ...data.userBookData[userBookIndex],
                    currentPosition: cfi,
                    progress: progress ?? data.userBookData[userBookIndex].progress,
                    totalPages: totalPages ?? data.userBookData[userBookIndex].totalPages,
                    currentPage: currentPage ?? data.userBookData[userBookIndex].currentPage,
                    lastReadAt: now,
                    updatedAt: now
                };
            } else {
                // Create new
                data.userBookData.push({
                    userId,
                    bookId,
                    currentPosition: cfi,
                    progress: progress ?? 0,
                    status: 'reading',
                    lastReadAt: now,
                    updatedAt: now
                });
            }

            // Also update the book global lastReadAt just for activity tracking if needed?
            // Actually, better to leave global book untouched if using users.
        } else {
            // Legacy / Single User Mode: Update Global Book
            const bookIndex = data.books?.findIndex((b: any) => b.id === bookId);

            if (bookIndex !== -1) {
                data.books[bookIndex] = {
                    ...data.books[bookIndex],
                    currentPosition: cfi,
                    progress: progress ?? data.books[bookIndex].progress,
                    totalPages: totalPages ?? data.books[bookIndex].totalPages,
                    lastReadAt: now,
                };
            }
        }

        // Always update Last Sync timestamp to indicate change
        data.lastSync = now;

        // Write Back
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));

        return NextResponse.json({ success: true, timestamp: now });

    } catch (error) {
        console.error('Heartbeat sync error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
