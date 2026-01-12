import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Define params type correctly for Next.js App Router
type Props = {
    params: Promise<{
        filename: string;
    }>;
};

export async function GET(
    req: NextRequest,
    { params }: Props
) {
    try {
        const customPath = req.headers.get('x-library-path');
        const libraryPath = customPath || process.env.LIBRARY_PATH;

        // Await params as per Next.js 15+ requirements
        const { filename } = await params;

        if (!libraryPath) {
            return NextResponse.json(
                { error: 'LIBRARY_PATH environment variable not set' },
                { status: 500 }
            );
        }

        // Prevent directory traversal
        const safeFilename = path.basename(filename);
        const filePath = path.join(libraryPath, safeFilename);

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
