import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const CONFIG_FILE = path.join(process.cwd(), 'server-config.json');

function getLibraryPath(req: NextRequest): string {
    // 1. Header (Highest Priority - Client Override)
    const customPath = req.headers.get('x-library-path');
    if (customPath) {
        // Persist valid custom path to server config
        try {
            fs.writeFileSync(CONFIG_FILE, JSON.stringify({ libraryPath: customPath }, null, 2));
            console.log(`Updated server config with library path: ${customPath}`);
        } catch (e) {
            console.error('Failed to write server config:', e);
        }
        return customPath;
    }

    // 2. Environment Variable
    if (process.env.LIBRARY_PATH) {
        return process.env.LIBRARY_PATH;
    }

    // 3. Server Config File (Persistence)
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
            if (config.libraryPath) {
                return config.libraryPath;
            }
        }
    } catch (e) {
        console.warn('Error reading server config:', e);
    }

    // 4. Default Fallback
    const defaultPath = path.join(process.cwd(), 'library');
    if (!fs.existsSync(defaultPath)) {
        // Try creating it if it doesn't exist? Only for default.
        // fs.mkdirSync(defaultPath, { recursive: true });
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
        console.log(`[POST] Received ${booksCount} books to save.`);

        // Ensure we are saving a valid structure
        const dataToSave = {
            books: body.books || [],
            tags: body.tags || [],
            annotations: body.annotations || [],
            readingSessions: body.readingSessions || [],
            lastSync: new Date().toISOString()
        };

        fs.writeFileSync(dbPath, JSON.stringify(dataToSave, null, 2));

        return NextResponse.json({ success: true, timestamp: dataToSave.lastSync });

    } catch (error) {
        console.error('Error saving metadata:', error);
        return NextResponse.json({ error: 'Failed to save metadata' }, { status: 500 });
    }
}
