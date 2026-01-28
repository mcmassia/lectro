
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getLibraryPath } from '@/lib/server/config';

export async function GET(req: NextRequest) {
    try {
        const libraryPath = getLibraryPath();
        if (!libraryPath || !fs.existsSync(libraryPath)) {
            return NextResponse.json({ chunks: [] });
        }

        const dbPath = path.join(libraryPath, 'lectro_vectors.json');
        if (!fs.existsSync(dbPath)) {
            return NextResponse.json({ chunks: [], lastSync: new Date().toISOString() });
        }

        // Reading large JSON might be heavy, but necessary for sync
        const data = fs.readFileSync(dbPath, 'utf8');
        return NextResponse.json(JSON.parse(data));

    } catch (error) {
        console.error('Error reading vector chunks:', error);
        return NextResponse.json({ error: 'Failed to read vectors' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json(); // { chunks: VectorChunk[] }
        const libraryPath = getLibraryPath();

        if (!fs.existsSync(libraryPath)) {
            fs.mkdirSync(libraryPath, { recursive: true });
        }

        const dbPath = path.join(libraryPath, 'lectro_vectors.json');

        let existingChunks: any[] = [];
        if (fs.existsSync(dbPath)) {
            try {
                existingChunks = JSON.parse(fs.readFileSync(dbPath, 'utf8')).chunks || [];
            } catch (e) { console.error('Error parsing existing vectors', e); }
        }

        const incomingChunks = body.chunks || [];
        console.log(`[VECTORS] Merging ${incomingChunks.length} incoming vectors with ${existingChunks.length} existing.`);

        // Merge Logic:
        // Identify chunks by ID. If ID exists, overwrite.
        // We do simple map-based merge.
        const chunkMap = new Map();
        existingChunks.forEach(c => chunkMap.set(c.id, c));

        // Incoming overrides existing
        incomingChunks.forEach((c: any) => chunkMap.set(c.id, c));

        // Handle deletions?
        // If body has 'deletedBookIds', remove chunks for those books?
        if (body.deletedBookIds && Array.isArray(body.deletedBookIds)) {
            const deletedSet = new Set(body.deletedBookIds);
            for (const [id, chunk] of chunkMap.entries()) {
                if (deletedSet.has(chunk.bookId)) {
                    chunkMap.delete(id);
                }
            }
        }

        const mergedChunks = Array.from(chunkMap.values());

        fs.writeFileSync(dbPath, JSON.stringify({
            chunks: mergedChunks,
            lastSync: new Date().toISOString()
        }, null, 2)); // Simplify null, 2 indentation is costly for 36MB? Maybe null, 0 for minification.
        // Actually for 36MB, indenting adds whitespace overhead. Let's stick to minified for vectors.
        // fs.writeFileSync(dbPath, JSON.stringify({ chunks: mergedChunks, lastSync: ... }));

        console.log(`[VECTORS] Saved ${mergedChunks.length} total vectors.`);

        return NextResponse.json({ success: true, count: mergedChunks.length });

    } catch (error) {
        console.error('Error saving vectors:', error);
        return NextResponse.json({ error: 'Failed to save vectors' }, { status: 500 });
    }
}
