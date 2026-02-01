import { NextRequest, NextResponse } from 'next/server';
import { JsonDb } from '@/lib/server/db';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { bookId, userId, cfi, progress, totalPages, currentPage } = body;

        console.log(`[Heartbeat] Received for book: ${bookId}, user: ${userId}, progress: ${progress}%`);

        if (!bookId || !cfi) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Use Safe JsonDb Update
        await JsonDb.update(async (data) => {
            const now = new Date().toISOString();
            let updated = false;

            if (userId) {
                // Update User-Specific Data (UserBookData)
                if (!data.userBookData) data.userBookData = [];

                const userBookIndex = data.userBookData.findIndex((d: any) => d.userId === userId && d.bookId === bookId);

                if (userBookIndex !== -1) {
                    // Update existing
                    console.log(`[Heartbeat] Updating existing UserBookData for user ${userId}`);
                    data.userBookData[userBookIndex] = {
                        ...data.userBookData[userBookIndex],
                        currentPosition: cfi,
                        progress: progress ?? data.userBookData[userBookIndex].progress,
                        totalPages: totalPages ?? data.userBookData[userBookIndex].totalPages,
                        currentPage: currentPage ?? data.userBookData[userBookIndex].currentPage,
                        lastReadAt: now,
                        updatedAt: now
                    };
                } else {
                    // Create new
                    console.log(`[Heartbeat] Creating NEW UserBookData for user ${userId}`);
                    data.userBookData.push({
                        userId,
                        bookId,
                        currentPosition: cfi,
                        progress: progress ?? 0,
                        status: 'reading',
                        lastReadAt: now,
                        updatedAt: now
                    });
                }
                updated = true;
            } else {
                // Legacy / Single User Mode: Update Global Book
                console.log(`[Heartbeat] No userId provided. Updating Legacy Book Object.`);
                const bookIndex = data.books?.findIndex((b: any) => b.id === bookId);

                if (bookIndex !== -1) {
                    data.books[bookIndex] = {
                        ...data.books[bookIndex],
                        currentPosition: cfi,
                        progress: progress ?? data.books[bookIndex].progress,
                        totalPages: totalPages ?? data.books[bookIndex].totalPages,
                        lastReadAt: now,
                    };
                    updated = true;
                } else {
                    console.error('[Heartbeat] Book not found in legacy mode');
                }
            }

            if (updated) {
                // Always update Last Sync timestamp to indicate change
                data.lastSync = now;
                return data;
            }
            return null; // Skip write if nothing updated
        });

        console.log(`[Heartbeat] Sync complete.`);
        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Heartbeat sync error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
