import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const CONFIG_FILE = path.join(process.cwd(), 'server-config.json');

function getLibraryPath(req: NextRequest): string {
    const headerPath = req.headers.get('x-library-path');
    if (headerPath) return headerPath;
    if (process.env.LECTRO_LIBRARY_PATH) return process.env.LECTRO_LIBRARY_PATH;

    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
            if (config.libraryPath) return config.libraryPath;
        }
    } catch (e) { }

    return path.join(process.cwd(), 'library');
}

/**
 * POST /api/library/cleanup-covers
 * Removes base64 encoded cover images from lectro_data.json
 * These bloat the JSON file unnecessarily since covers are served separately
 */
export async function POST(req: NextRequest) {
    try {
        const libraryPath = getLibraryPath(req);
        console.log(`[Cleanup Covers] Starting base64 cover cleanup in: ${libraryPath}`);

        const dbPath = path.join(libraryPath, 'lectro_data.json');
        if (!fs.existsSync(dbPath)) {
            return NextResponse.json({ error: 'Database not found' }, { status: 404 });
        }

        const rawData = fs.readFileSync(dbPath, 'utf8');
        const data = JSON.parse(rawData);
        const books = data.books || [];

        let cleanedCount = 0;
        let totalBase64Size = 0;

        for (const book of books) {
            // Check if cover is a base64 data URI
            if (book.cover && typeof book.cover === 'string' && book.cover.startsWith('data:image')) {
                totalBase64Size += book.cover.length;
                // Remove the base64 cover - the app will fetch from /api/covers/[bookId] instead
                delete book.cover;
                cleanedCount++;
                console.log(`[Cleanup Covers] Removed base64 cover from: ${book.title}`);
            }
        }

        if (cleanedCount > 0) {
            // Write the cleaned data back
            fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));

            // Calculate size savings
            const newSize = fs.statSync(dbPath).size;
            const savedBytes = totalBase64Size;
            const savedMB = (savedBytes / (1024 * 1024)).toFixed(2);

            console.log(`[Cleanup Covers] Completed. Removed ${cleanedCount} base64 covers, saved ~${savedMB}MB`);

            return NextResponse.json({
                success: true,
                cleanedCount,
                savedBytes,
                savedMB: parseFloat(savedMB),
                message: `Removed ${cleanedCount} base64 covers, saved approximately ${savedMB}MB`
            });
        }

        return NextResponse.json({
            success: true,
            cleanedCount: 0,
            savedBytes: 0,
            savedMB: 0,
            message: 'No base64 covers found to clean'
        });

    } catch (error) {
        console.error('[Cleanup Covers] Failed:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

/**
 * GET /api/library/cleanup-covers
 * Preview how many base64 covers would be cleaned (dry run)
 */
export async function GET(req: NextRequest) {
    try {
        const libraryPath = getLibraryPath(req);
        const dbPath = path.join(libraryPath, 'lectro_data.json');

        if (!fs.existsSync(dbPath)) {
            return NextResponse.json({ error: 'Database not found' }, { status: 404 });
        }

        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        const books = data.books || [];

        let base64Count = 0;
        let totalBase64Size = 0;
        const affectedBooks: { id: string; title: string; coverSize: number }[] = [];

        for (const book of books) {
            if (book.cover && typeof book.cover === 'string' && book.cover.startsWith('data:image')) {
                base64Count++;
                totalBase64Size += book.cover.length;
                affectedBooks.push({
                    id: book.id,
                    title: book.title,
                    coverSize: book.cover.length
                });
            }
        }

        const sizeMB = (totalBase64Size / (1024 * 1024)).toFixed(2);

        return NextResponse.json({
            preview: true,
            base64Count,
            totalBase64Size,
            sizeMB: parseFloat(sizeMB),
            affectedBooks,
            message: `Found ${base64Count} books with base64 covers (~${sizeMB}MB). Use POST to clean.`
        });

    } catch (error) {
        console.error('[Cleanup Covers Preview] Failed:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
