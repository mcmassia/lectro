import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const CONFIG_FILE = path.join(process.cwd(), 'server-config.json');

function getLibraryPath(req: NextRequest): string {
    // 4. Validate and Fallback
    // If we found a path from any source (Config, Env, Header), check if it exists.
    // If not, fall back to default project library.

    // We need to keep the "candidate" path to check existence
    let candidatePath = '';

    // Re-evaluating priority structure to include validation:

    // 1. Header
    const headerPath = req.headers.get('x-library-path');
    if (headerPath) candidatePath = headerPath;

    // 2. Env
    else if (process.env.LECTRO_LIBRARY_PATH) candidatePath = process.env.LECTRO_LIBRARY_PATH;

    // 3. Config
    else {
        try {
            if (fs.existsSync(CONFIG_FILE)) {
                const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
                if (config.libraryPath) candidatePath = config.libraryPath;
            }
        } catch (e) { /* ignore */ }
    }

    // Validate Candidate
    if (candidatePath && fs.existsSync(candidatePath)) {
        // If header provided valid path, verify we persist it if it's new? 
        // Logic in original code persisted header path. We should keep that behavior if desired, 
        // but robustly.
        if (headerPath && headerPath === candidatePath) {
            try {
                // simple comparison to avoid unnecessary writes
                const currentConfig = fs.existsSync(CONFIG_FILE) ? JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) : {};
                if (currentConfig.libraryPath !== headerPath) {
                    fs.writeFileSync(CONFIG_FILE, JSON.stringify({ libraryPath: headerPath }, null, 2));
                }
            } catch (e) { /* ignore */ }
        }
        return candidatePath;
    }

    // 4. Default Fallback (if candidate missing or invalid)
    console.warn(`Configured path "${candidatePath}" not found. Falling back to default.`);
    const defaultPath = path.join(process.cwd(), 'library');
    // Ensure default exists
    if (!fs.existsSync(defaultPath)) {
        try {
            fs.mkdirSync(defaultPath, { recursive: true });
        } catch (e) { /* ignore */ }
    }
    return defaultPath;
}

export async function GET(req: NextRequest) {
    try {
        const libraryPath = getLibraryPath(req);
        console.log(`[GET] Using library path: ${libraryPath}`);

        if (!libraryPath || !fs.existsSync(libraryPath)) {
            // Check if we should auto-create default?
            if (libraryPath.endsWith('/library') && !fs.existsSync(libraryPath)) {
                try {
                    fs.mkdirSync(libraryPath, { recursive: true });
                    console.log(`Created default library path: ${libraryPath}`);
                } catch (e) { /* ignore */ }
            } else {
                console.error(`Library path does not exist: ${libraryPath}`);
                return NextResponse.json({ error: `Library path not found: ${libraryPath}` }, { status: 404 });
            }
        }

        const dbPath = path.join(libraryPath, 'lectro_data.json');
        console.log(`[GET] Reading metadata from: ${dbPath}`);

        if (!fs.existsSync(dbPath)) {
            return NextResponse.json({
                books: [],
                tags: [],
                annotations: [],
                lastSync: new Date().toISOString()
            });
        }

        const data = fs.readFileSync(dbPath, 'utf8');
        return NextResponse.json(JSON.parse(data));

    } catch (error) {
        console.error('Error reading metadata:', error);
        return NextResponse.json({ error: 'Failed to read metadata' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const libraryPath = getLibraryPath(req);
        console.log(`[POST] Using library path: ${libraryPath}`);

        if (!fs.existsSync(libraryPath)) {
            try {
                fs.mkdirSync(libraryPath, { recursive: true });
            } catch (e) {
                return NextResponse.json({ error: `Library path does not exist and could not be created: ${libraryPath}` }, { status: 500 });
            }
        }

        const dbPath = path.join(libraryPath, 'lectro_data.json');
        console.log(`[POST] Writing metadata to: ${dbPath}`);

        const booksCount = body.books?.length || 0;
        console.log(`[POST] Received ${booksCount} books to merge.`);

        // Read existing data to merge
        let existingData: any = { books: [], tags: [], annotations: [], readingSessions: [] };
        if (fs.existsSync(dbPath)) {
            try {
                const fileContent = fs.readFileSync(dbPath, 'utf8');
                existingData = JSON.parse(fileContent);
            } catch (e) {
                console.error('Failed to parse existing metadata, starting fresh:', e);
            }
        }

        // Helper to merge arrays by ID
        const mergeById = (existing: any[], incoming: any[], deletedIds: string[] = []) => {
            const map = new Map(existing.map(item => [item.id || item.name, item]));

            // Apply deletions first
            deletedIds.forEach(id => map.delete(id));

            // Apply updates/additions
            if (incoming && incoming.length > 0) {
                incoming.forEach(item => {
                    if (item.id) map.set(item.id, item);
                });
            }
            return Array.from(map.values());
        };

        const deletedBookIds = body.deletedBookIds || [];
        if (deletedBookIds.length > 0) {
            console.log(`[POST] Removing ${deletedBookIds.length} books:`, deletedBookIds);
        }

        // Merge Logic
        const mergedBooks = mergeById(existingData.books || [], body.books || [], deletedBookIds);
        const mergedTags = mergeById(existingData.tags || [], body.tags || []);
        const mergedAnnotations = mergeById(existingData.annotations || [], body.annotations || []);
        const mergedSessions = (body.readingSessions && body.readingSessions.length > 0)
            ? body.readingSessions
            : (existingData.readingSessions || []);

        const dataToSave = {
            books: mergedBooks,
            tags: mergedTags,
            annotations: mergedAnnotations,
            readingSessions: mergedSessions,
            lastSync: new Date().toISOString()
        };

        fs.writeFileSync(dbPath, JSON.stringify(dataToSave, null, 2));

        return NextResponse.json({ success: true, timestamp: dataToSave.lastSync, mergedBooks: mergedBooks.length });

    } catch (error) {
        console.error('Error saving metadata FULL DETAILS:', error);
        return NextResponse.json({
            error: 'Failed to save metadata',
            details: (error as Error).message,
            stack: (error as Error).stack
        }, { status: 500 });
    }
}
