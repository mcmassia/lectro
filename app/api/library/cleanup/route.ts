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

// Fuzzy path resolution helper (duplicated from ReadiumHelper for independence)
function resolveFuzzyPath(libraryPath: string, targetPath: string): string | null {
    try {
        // 1. Check if exact file exists
        if (fs.existsSync(targetPath)) return targetPath;

        // 2. Normalization check
        const candidates = [
            targetPath,
            targetPath.normalize('NFC'),
            targetPath.normalize('NFD')
        ];
        for (const c of candidates) {
            if (fs.existsSync(c)) return c;
        }

        // 3. Fuzzy directory walk
        // Ensure strictly under library path
        if (!targetPath.startsWith(libraryPath)) return null;

        const relPath = path.relative(libraryPath, targetPath);
        const segments = relPath.split(path.sep);
        let currentPath = libraryPath;

        for (const segment of segments) {
            // Check direct
            const direct = path.join(currentPath, segment);
            if (fs.existsSync(direct)) {
                currentPath = direct;
                continue;
            }

            // Check fuzzy
            if (!fs.existsSync(currentPath) || !fs.statSync(currentPath).isDirectory()) return null;

            const siblings = fs.readdirSync(currentPath);
            const clean = (s: string) => s.normalize('NFD').replace(/[^\x20-\x7E]/g, '').toLowerCase();
            const targetClean = clean(segment);

            const match = siblings.find(sib => clean(sib) === targetClean);
            if (match) {
                currentPath = path.join(currentPath, match);
            } else {
                return null;
            }
        }

        return currentPath;

    } catch (e) {
        return null;
    }
}

export async function POST(req: NextRequest) {
    try {
        const libraryPath = getLibraryPath(req);
        console.log(`[Cleanup] Starting library cleanup in: ${libraryPath}`);

        const dbPath = path.join(libraryPath, 'lectro_data.json');
        if (!fs.existsSync(dbPath)) {
            return NextResponse.json({ error: 'Database not found' }, { status: 404 });
        }

        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        const books = data.books || [];
        const initialCount = books.length;

        const validBooks: any[] = [];
        const deletedIds: string[] = [];

        for (const book of books) {
            const filePath = book.filePath || book.fileName; // Fallback
            if (!filePath) {
                deletedIds.push(book.id);
                continue;
            }

            const fullPath = path.join(libraryPath, filePath);

            // Check existence using robust fuzzy logic
            const resolved = resolveFuzzyPath(libraryPath, fullPath);

            if (resolved) {
                // Determine if we need to update the path in DB 
                // (e.g. if we found it via fuzzy match but DB has broken path)
                // For safety, let's just keep the book. 
                // Updating path here would be nice but let's stick to "Delete if missing" first.
                validBooks.push(book);
            } else {
                console.log(`[Cleanup] marking for deletion: ${book.title} (File not found: ${filePath})`);
                deletedIds.push(book.id);
            }
        }

        if (deletedIds.length > 0) {
            console.log(`[Cleanup] Removing ${deletedIds.length} missing books.`);

            // Filter other collections if needed
            data.books = validBooks;
            // We should also duplicate cleaning for annotations etc but usually client handles cascade. 
            // Minimal: correct the books array.

            // Clean related data?
            if (data.annotations) {
                data.annotations = data.annotations.filter((a: any) => !deletedIds.includes(a.bookId));
            }

            fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
        }

        return NextResponse.json({
            success: true,
            initialCount,
            finalCount: validBooks.length,
            deletedIds
        });

    } catch (error) {
        console.error('Cleanup failed:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
