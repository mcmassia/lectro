import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
    try {
        const customPath = req.headers.get('x-library-path');
        let libraryPath = customPath || process.env.LIBRARY_PATH;

        // Same fallback logic as scan/route.ts
        if (!libraryPath && process.env.NODE_ENV === 'development') {
            const defaultPath = path.join(process.cwd(), 'library');
            if (fs.existsSync(defaultPath)) {
                libraryPath = defaultPath;
            }
        }

        if (!libraryPath || !fs.existsSync(libraryPath)) {
            return NextResponse.json({ error: 'Library path not configured' }, { status: 500 });
        }

        const dbPath = path.join(libraryPath, 'lectro_data.json');

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
        const customPath = req.headers.get('x-library-path');
        let libraryPath = customPath || process.env.LIBRARY_PATH;

        if (!libraryPath && process.env.NODE_ENV === 'development') {
            const defaultPath = path.join(process.cwd(), 'library');
            if (fs.existsSync(defaultPath)) {
                libraryPath = defaultPath;
            }
        }

        if (!libraryPath || !fs.existsSync(libraryPath)) {
            return NextResponse.json({ error: 'Library path not configured' }, { status: 500 });
        }

        const dbPath = path.join(libraryPath, 'lectro_data.json');

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
