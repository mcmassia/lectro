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
        const { bookId, cfi, progress, totalPages, currentPage } = await req.json();

        if (!bookId || !cfi) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const libraryPath = getLibraryPath();
        const dbPath = path.join(libraryPath, 'lectro_data.json');

        if (!fs.existsSync(dbPath)) {
            return NextResponse.json({ error: 'Library DB not found' }, { status: 404 });
        }

        // Read DB
        // Lock mechanism would be ideal here but file system locking is complex in Node. 
        // For personal use, conflict risk is low.
        const fileContent = fs.readFileSync(dbPath, 'utf8');
        const data = JSON.parse(fileContent);

        const bookIndex = data.books?.findIndex((b: any) => b.id === bookId);

        if (bookIndex === -1) {
            return NextResponse.json({ error: 'Book not found' }, { status: 404 });
        }

        // Update Book
        const now = new Date().toISOString();
        data.books[bookIndex] = {
            ...data.books[bookIndex],
            currentPosition: cfi,
            progress: progress ?? data.books[bookIndex].progress,
            totalPages: totalPages ?? data.books[bookIndex].totalPages,
            lastReadAt: new Date(now), // Ensure it's a Date object if using a library that handles it, or string
            // JSON serialization will make it a string anyway
        };
        // Normalize date just in case
        data.books[bookIndex].lastReadAt = now;

        // Also update Last Sync time?
        data.lastSync = now;

        // Write Back
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));

        return NextResponse.json({ success: true, timestamp: now });

    } catch (error) {
        console.error('Heartbeat sync error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
