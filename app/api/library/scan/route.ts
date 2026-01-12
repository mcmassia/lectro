import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
    try {
        const customPath = req.headers.get('x-library-path');
        let libraryPath = customPath || process.env.LIBRARY_PATH;

        if (!libraryPath) {
            // Fallback for local development
            if (process.env.NODE_ENV === 'development') {
                const defaultPath = path.join(process.cwd(), 'library');
                if (!fs.existsSync(defaultPath)) {
                    try {
                        fs.mkdirSync(defaultPath, { recursive: true });
                    } catch (e) {
                        console.error('Failed to create default library path:', e);
                    }
                }
                if (fs.existsSync(defaultPath)) {
                    libraryPath = defaultPath;
                }
            }
        }

        if (!libraryPath) {
            return NextResponse.json(
                { error: 'LIBRARY_PATH environment variable not set. Please configure the Server Path in Settings or set the env var.' },
                { status: 500 }
            );
        }

        if (!fs.existsSync(libraryPath)) {
            // Try to create it if it doesn't exist
            try {
                fs.mkdirSync(libraryPath, { recursive: true });
            } catch (err) {
                return NextResponse.json(
                    { error: `Library directory does not exist and could not be created at ${libraryPath}` },
                    { status: 500 }
                );
            }
        }

        const files = fs.readdirSync(libraryPath);
        const fileList = files
            .filter(file => {
                const ext = path.extname(file).toLowerCase();
                return ext === '.epub' || ext === '.pdf';
            })
            .map(file => {
                const filePath = path.join(libraryPath, file);
                const stats = fs.statSync(filePath);
                return {
                    name: file,
                    size: stats.size,
                    modifiedTime: stats.mtime.toISOString(),
                };
            });

        return NextResponse.json({ files: fileList });
    } catch (error) {
        console.error('Error scanning library:', error);
        return NextResponse.json(
            {
                error: `Failed to scan library directory: ${(error as Error).message}`,
                details: error
            },
            { status: 500 }
        );
    }
}
