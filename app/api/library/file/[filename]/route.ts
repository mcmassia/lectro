import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Define params type correctly for Next.js App Router
type Props = {
    params: Promise<{
        filename: string;
    }>;
};

import { getLibraryPath } from '@/lib/server/config';

// ...

export async function GET(
    req: NextRequest,
    { params }: Props
) {
    try {
        const libraryPath = getLibraryPath();

        // Check query param 'path' first, fallback to filename param
        // We need to parse searchParams from req.url
        const url = new URL(req.url);
        const relativePath = url.searchParams.get('path');

        // Await params as per Next.js 15+ requirements
        const { filename } = await params;


        if (!libraryPath) {
            return NextResponse.json(
                { error: 'LECTRO_LIBRARY_PATH environment variable not set' },
                { status: 500 }
            );
        }

        let filePath;
        let safeFilename;

        if (relativePath) {
            // Validate relative path to prevent traversal
            const normalized = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, '');
            filePath = path.join(libraryPath, normalized);
            safeFilename = path.basename(filePath);
        } else {
            // Fallback to flat filename
            safeFilename = path.basename(filename);
            filePath = path.join(libraryPath, safeFilename);
        }

        if (!fs.existsSync(filePath)) {
            return NextResponse.json(
                { error: 'File not found' },
                { status: 404 }
            );
        }

        const fileBuffer = fs.readFileSync(filePath);
        const stats = fs.statSync(filePath);

        const ext = path.extname(safeFilename).toLowerCase();
        let contentType = 'application/octet-stream';
        if (ext === '.epub') contentType = 'application/epub+zip';
        if (ext === '.pdf') contentType = 'application/pdf';

        return new NextResponse(fileBuffer, {
            headers: {
                'Content-Type': contentType,
                'Content-Length': stats.size.toString(),
                'Content-Disposition': `attachment; filename="${safeFilename}"`,
            },
        });
    } catch (error) {
        console.error('Error reading file:', error);
        return NextResponse.json(
            { error: 'Failed to read file' },
            { status: 500 }
        );
    }
}

export async function POST(
    req: NextRequest,
    { params }: Props
) {
    try {
        const customPath = req.headers.get('x-library-path');
        const author = req.headers.get('x-book-author');
        const title = req.headers.get('x-book-title');

        const libraryPath = getLibraryPath();

        // Await params as per Next.js 15+ requirements
        const { filename } = await params;

        if (!libraryPath) {
            return NextResponse.json(
                { error: 'LECTRO_LIBRARY_PATH environment variable not set' },
                { status: 500 }
            );
        }

        // Determine destination folder
        let targetDir = libraryPath;
        if (author && title) {
            // Sanitize names for FS
            const safeAuthor = author.replace(/[^a-z0-9\s.-]/gi, '').trim() || 'Unknown';
            const safeTitle = title.replace(/[^a-z0-9\s.-]/gi, '').trim() || 'Unknown';

            // Structure: Library / Author / Title / [files]
            targetDir = path.join(libraryPath, safeAuthor, safeTitle);
        } else if (author) {
            const safeAuthor = author.replace(/[^a-z0-9\s.-]/gi, '').trim() || 'Unknown';
            targetDir = path.join(libraryPath, safeAuthor);
        }

        // Ensure directory exists
        if (!fs.existsSync(targetDir)) {
            try {
                fs.mkdirSync(targetDir, { recursive: true });
            } catch (err) {
                return NextResponse.json(
                    { error: 'Failed to create directory structure' },
                    { status: 500 }
                );
            }
        }

        // Prevent directory traversal on filename
        const safeFilename = path.basename(filename);
        const filePath = path.join(targetDir, safeFilename);

        // Write file
        const arrayBuffer = await req.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        fs.writeFileSync(filePath, buffer);

        // Calculate relative path for client
        const relativePath = path.relative(libraryPath, filePath);

        return NextResponse.json({
            success: true,
            message: 'File uploaded successfully',
            path: filePath,
            relativePath: relativePath
        });

    } catch (error) {
        console.error('Error uploading file:', error);
        return NextResponse.json(
            { error: 'Failed to upload file' },
            { status: 500 }
        );
    }
}
