import { NextRequest, NextResponse } from 'next/server';
import { ReadiumHelper } from '@/lib/server/readium';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ bookId: string }> }
) {
    try {
        const { bookId } = await params;
        const helper = new ReadiumHelper(bookId);

        // Ensure book is unzipped
        if (!helper.isUnzipped()) {
            try {
                helper.unzip();
            } catch (e) {
                console.error('Failed to unzip book:', e);
                return NextResponse.json({ error: 'Failed to process book' }, { status: 500 });
            }
        }

        const manifest = helper.getManifest();

        return new NextResponse(JSON.stringify(manifest), {
            headers: {
                'Content-Type': 'application/webpub+json',
                'Cache-Control': 'no-cache' // For dev, maybe cache later
            }
        });

    } catch (error) {
        console.error('Manifest error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
