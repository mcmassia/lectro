import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
    try {
        const customPath = req.headers.get('x-library-path');
        let libraryPath = customPath || process.env.LECTRO_LIBRARY_PATH;

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
                { error: 'LECTRO_LIBRARY_PATH environment variable not set. Please configure the Server Path in Settings or set the env var.' },
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

        const getFilesRecursively = (dir: string, baseDir: string, currentDepth: number = 0, maxDepth: number = 3): { name: string, relativePath: string, size: number, modifiedTime: string }[] => {
            if (currentDepth > maxDepth) return [];

            let results: { name: string, relativePath: string, size: number, modifiedTime: string }[] = [];

            try {
                const list = fs.readdirSync(dir);

                for (const file of list) {
                    try {
                        const filePath = path.join(dir, file);
                        const stat = fs.statSync(filePath);

                        if (stat && stat.isDirectory()) {
                            results = results.concat(getFilesRecursively(filePath, baseDir, currentDepth + 1, maxDepth));
                        } else {
                            const ext = path.extname(file).toLowerCase();
                            if (ext === '.epub' || ext === '.pdf') {
                                results.push({
                                    name: file,
                                    relativePath: path.relative(baseDir, filePath),
                                    size: stat.size,
                                    modifiedTime: stat.mtime.toISOString(),
                                });
                            }
                        }
                    } catch (err) {
                        console.warn(`Error processing file in ${dir}: ${file}`, err);
                        // Skip problematic file
                    }
                }
            } catch (err) {
                console.warn(`Error reading directory ${dir}:`, err);
                // Skip problematic directory
            }
            return results;
        };

        const fileList = getFilesRecursively(libraryPath, libraryPath);

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
