import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Prevent directory traversal
function isSafePath(targetPath: string, rootPath: string): boolean {
    const resolvedTarget = path.resolve(targetPath);
    const resolvedRoot = path.resolve(rootPath);
    return resolvedTarget.startsWith(resolvedRoot);
}

// Simple MIME detection to avoid external dependency
function getContentType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
        case '.epub': return 'application/epub+zip';
        case '.pdf': return 'application/pdf';
        case '.jpg':
        case '.jpeg': return 'image/jpeg';
        case '.png': return 'image/png';
        default: return 'application/octet-stream';
    }
}

// Helper to get library path (reused logic)
function getLibraryPath(): string {
    // 1. Try server config
    const configPath = path.join(process.cwd(), 'server-config.json');
    try {
        if (fs.existsSync(configPath)) {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            if (config.libraryPath) return config.libraryPath;
        }
    } catch (e) { /* ignore */ }

    // 2. Env
    if (process.env.LIBRARY_PATH) return process.env.LIBRARY_PATH;

    // 3. Default
    return path.join(process.cwd(), 'library');
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    try {
        const { path: pathSegments } = await params;
        if (!pathSegments || pathSegments.length === 0) {
            return NextResponse.json({ error: 'File path not specified' }, { status: 400 });
        }

        const libraryPath = getLibraryPath();
        // Decode URI components to handle spaces and special chars
        const relativePath = pathSegments.map(segment => decodeURIComponent(segment)).join('/');
        const filePath = path.join(libraryPath, relativePath);

        if (!isSafePath(filePath, libraryPath)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        if (!fs.existsSync(filePath)) {
            return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }

        const stat = fs.statSync(filePath);
        const fileSize = stat.size;

        const contentType = getContentType(filePath);

        // Stream file
        const fileStream = fs.createReadStream(filePath);

        // Convert Node stream to Web Stream
        const readableStream = new ReadableStream({
            start(controller) {
                fileStream.on('data', (chunk) => controller.enqueue(chunk));
                fileStream.on('end', () => controller.close());
                fileStream.on('error', (err) => controller.error(err));
            }
        });

        return new NextResponse(readableStream, {
            headers: {
                'Content-Type': contentType,
                'Content-Length': fileSize.toString(),
                'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
            }
        });

    } catch (error) {
        console.error('Stream error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
