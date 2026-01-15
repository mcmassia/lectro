import { NextRequest, NextResponse } from 'next/server';
import { ReadiumHelper } from '@/lib/server/readium';
import fs from 'fs';
import path from 'path';
import mime from 'mime-types';

// We need to access the cache path logic. 
// Ideally ReadiumHelper exposes it or we duplicate logic slightly.
// Let's modify ReadiumHelper to expose `getCachePath()` or similar public getter?
// Or just replicate `library/_cache/[bookId]` logic since it's standard convention we defined.

const CACHE_DIR_NAME = '_cache';

function getLibraryPath(): string {
    const CONFIG_FILE = path.join(process.cwd(), 'server-config.json');
    if (process.env.LECTRO_LIBRARY_PATH) return process.env.LECTRO_LIBRARY_PATH;
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
            if (config.libraryPath) return config.libraryPath;
        }
    } catch (e) { }
    return path.join(process.cwd(), 'library');
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ bookId: string; path: string[] }> }
) {
    try {
        const { bookId, path: pathSegments } = await params;

        // Sanity Check
        if (!bookId || !pathSegments || pathSegments.length === 0) {
            return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
        }

        const libraryPath = getLibraryPath();
        const cachePath = path.join(libraryPath, CACHE_DIR_NAME, bookId);

        // Prevent directory traversal attacks
        // Join segments and normalize
        const relativePath = path.join(...pathSegments);
        const fullPath = path.join(cachePath, relativePath);

        if (!fullPath.startsWith(cachePath)) {
            console.error(`[Readium Resource] Forbidden access: ${fullPath} (outside ${cachePath})`);
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
            console.error(`[Readium Resource] File not found: ${fullPath}`);
            // List directory content to debug casing issues
            const parentDir = path.dirname(fullPath);
            if (fs.existsSync(parentDir)) {
                console.log(`[Readium Resource] Contents of ${parentDir}:`, fs.readdirSync(parentDir));
            } else {
                console.log(`[Readium Resource] Parent directory ${parentDir} does not exist`);
            }
            return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }

        const fileBuffer = fs.readFileSync(fullPath);
        const mimeType = mime.lookup(fullPath) || 'application/octet-stream';

        return new NextResponse(fileBuffer, {
            headers: {
                'Content-Type': mimeType,
                'Cache-Control': 'public, max-age=31536000, immutable'
            }
        });

    } catch (error) {
        console.error('Resource error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
