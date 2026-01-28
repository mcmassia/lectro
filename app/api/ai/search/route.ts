
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getLibraryPath } from '@/lib/server/config';
import { generateEmbedding } from '@/lib/ai/gemini';

// Simple cosine similarity
function cosineSimilarity(vecA: number[], vecB: number[]) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function POST(req: NextRequest) {
    try {
        const { query, limit = 20 } = await req.json();

        if (!query) {
            return NextResponse.json({ error: 'Query is required' }, { status: 400 });
        }

        // 1. Generate Query Embedding
        const embedding = await generateEmbedding(query);
        if (!embedding) {
            return NextResponse.json({ error: 'Failed to generate embedding' }, { status: 500 });
        }

        // 2. Load Vectors
        const libraryPath = getLibraryPath();
        const dbPath = path.join(libraryPath, 'lectro_vectors.json');

        if (!fs.existsSync(dbPath)) {
            return NextResponse.json({ results: [] });
        }

        let vectors: any[] = [];
        try {
            // In-memory load. 
            // OPTIMIZATION: In production/large scale, use a real Vector DB (pgvector, pinecone).
            // For 6000 books * metadata (36MB), this is fast (<100ms parse).
            // For 3.6GB full index, this will CRASH or be slow.
            // Since we are moving to Server-Side, we assume Metadata First (36MB) is the primary target for now.
            // If full index exists, we might need stream processing or just accept it's heavy for file-based.
            // Ideally: Slice it? Or verify file size.
            const data = fs.readFileSync(dbPath, 'utf8');
            // vectors = JSON.parse(data).chunks || [];
            // Use JSON.parse with care for memory.
            const parsed = JSON.parse(data);
            vectors = parsed.chunks || [];
        } catch (e) {
            console.error('Error reading vectors:', e);
            return NextResponse.json({ error: 'Index read failed' }, { status: 500 });
        }

        // 3. Search
        const results = vectors.map(v => ({
            id: v.bookId,
            score: cosineSimilarity(embedding, v.embedding),
            text: v.text, // Snippet
            chapterTitle: v.chapterTitle
        }))
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);

        // Group by book? usually we want specific chunks.
        // Return valid chunks.
        return NextResponse.json({ results });

    } catch (error: any) {
        console.error('Search API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
