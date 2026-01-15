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
            } catch (e: any) {
                console.error('Failed to unzip book:', e);
                return NextResponse.json({
                    error: e.message || 'Failed to process book',
                    details: e.toString()
                }, { status: 500 });
            }
        }

        const manifest = helper.getManifest();

        return new NextResponse(JSON.stringify(manifest), {
            headers: {
                'Content-Type': 'application/webpub+json',
                'Cache-Control': 'no-cache' // For dev, maybe cache later
            }
        });

    } catch (error: any) {
        console.error('Manifest error:', error);
        return NextResponse.json({
            error: error.message || 'Internal Server Error',
            details: error.toString()
        }, { status: 500 });
    }
}
