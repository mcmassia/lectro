import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import AdmZip from 'adm-zip';

const CONFIG_FILE = path.join(process.cwd(), 'server-config.json');

function getLibraryPath(): string {
    // 1. Env
    if (process.env.LECTRO_LIBRARY_PATH) return process.env.LECTRO_LIBRARY_PATH;

    // 2. Config
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
            if (config.libraryPath) return config.libraryPath;
        }
    } catch (e) { }

    // 3. Fallback
    return path.join(process.cwd(), 'library');
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ bookId: string }> }
) {
    try {
        const { bookId } = await params;
        const width = parseInt(req.nextUrl.searchParams.get('width') || '300'); // Default slightly larger for retina
        const quality = parseInt(req.nextUrl.searchParams.get('quality') || '80');

        const libraryPath = getLibraryPath();
        const dbPath = path.join(libraryPath, 'lectro_data.json');

        if (!fs.existsSync(dbPath)) {
            return NextResponse.json({ error: 'Library DB not found' }, { status: 404 });
        }

        // 1. Find Book
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        const book = data.books?.find((b: any) => b.id === bookId);

        if (!book || (!book.filePath && !book.fileName)) {
            return NextResponse.json({ error: 'Book not found on server' }, { status: 404 });
        }

        let filePath = '';
        if (book.filePath) {
            filePath = path.join(libraryPath, book.filePath);
        }

        // Fallback: If filePath is missing or file doesn't exist, try to find it by fileName in library root
        if (!filePath || !fs.existsSync(filePath)) {
            if (book.fileName) {
                const fallbackPath = path.join(libraryPath, book.fileName);
                if (fs.existsSync(fallbackPath)) {
                    filePath = fallbackPath;
                } else {
                    // Try recursive search? (Expensive)
                    // For now, let's assume if it's not at path and not at root, it's missing.
                    // But we can try one level deep (Author/Book)?
                    // Or rely on the 'scan' logic if we want to be smarter. 
                    // Let's stick to root fallback for now as that's the common case for simple sync.
                }
            }
        }

        if (!filePath || !fs.existsSync(filePath)) {
            return NextResponse.json({ error: 'Book file not found' }, { status: 404 });
        }

        // 2. First, check for external cover file in the same directory (cover.jpg, cover.png, cover.webp)
        const bookDir = path.dirname(filePath);
        const coverExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
        let coverBuffer: Buffer | null = null;

        for (const ext of coverExtensions) {
            const externalCoverPath = path.join(bookDir, `cover.${ext}`);
            if (fs.existsSync(externalCoverPath)) {
                try {
                    coverBuffer = fs.readFileSync(externalCoverPath);
                    console.log(`[Covers] Using external cover file: ${externalCoverPath}`);
                    break;
                } catch (e) {
                    console.error(`Failed to read external cover: ${externalCoverPath}`, e);
                }
            }
        }

        // 3. If no external cover, try extracting from EPUB
        const ext = path.extname(filePath).toLowerCase();

        if (!coverBuffer && ext === '.epub') {
            try {
                const zip = new AdmZip(filePath);

                // A. Find OPF Path
                const containerEntry = zip.getEntry('META-INF/container.xml');
                if (!containerEntry) throw new Error('Invalid EPUB: No container.xml');

                const containerXml = containerEntry.getData().toString('utf8');
                const opfMatch = containerXml.match(/full-path="([^"]+)"/);
                if (!opfMatch) throw new Error('Invalid EPUB: No Rootfile found');

                const opfPath = opfMatch[1];
                const opfDir = path.dirname(opfPath);

                // B. Parse OPF to find Cover
                const opfEntry = zip.getEntry(opfPath);
                if (!opfEntry) throw new Error('OPF file missing');

                const opfContent = opfEntry.getData().toString('utf8');

                // Strategy 1: Find item with properties="cover-image"
                let coverHref = '';
                const itemMatch = opfContent.match(/<item[^>]*properties="[^"]*cover-image[^"]*"[^>]*href="([^"]+)"/i);

                if (itemMatch) {
                    coverHref = itemMatch[1];
                } else {
                    // Strategy 2: Find meta name="cover" content="id" -> item id="id" href="..."
                    const metaMatch = opfContent.match(/<meta[^>]*name="cover"[^>]*content="([^"]+)"/i);
                    if (metaMatch) {
                        const coverId = metaMatch[1];
                        const idRegex = new RegExp(`<item[^>]*id="${coverId}"[^>]*href="([^"]+)"`, 'i');
                        const idMatch = opfContent.match(idRegex);
                        if (idMatch) coverHref = idMatch[1];
                    } else {
                        // Strategy 3: Guess
                        if (zip.getEntry('cover.jpg')) coverHref = 'cover.jpg';
                        else if (zip.getEntry('OEBPS/cover.jpg')) coverHref = 'OEBPS/cover.jpg'; // Just logical guess, usually won't work due to pathing
                    }
                }

                if (coverHref) {
                    // Resolve path (coverHref is relative to OPF)
                    // If opfDir is '.', path.join might add ./, simplify it
                    const fullCoverPath = opfDir === '.' ? coverHref : path.join(opfDir, coverHref).replace(/\\/g, '/'); // Ensure forward slashes for ZIP

                    const coverEntry = zip.getEntry(fullCoverPath);
                    if (coverEntry) {
                        coverBuffer = coverEntry.getData();
                    } else {
                        // Fallback: try decoding URL chars
                        const decodedPath = decodeURIComponent(fullCoverPath);
                        const coverEntryDecoded = zip.getEntry(decodedPath);
                        if (coverEntryDecoded) coverBuffer = coverEntryDecoded.getData();
                    }
                }

            } catch (e) {
                console.error('EPUB extraction failed:', e);
                // Fallback to auto-generation? 
            }

        } else if (ext === '.pdf') {
            // PDF: Not implemented yet
            // return NextResponse.json({ error: 'PDF Not Supported' }, { status: 501 });
        }

        if (!coverBuffer) {
            // Fallback: Check if book record has a stored cover (base64 data URL)
            if (book.cover && typeof book.cover === 'string' && book.cover.startsWith('data:image')) {
                try {
                    // Extract base64 part from data URL
                    const base64Match = book.cover.match(/^data:image\/[^;]+;base64,(.+)$/);
                    if (base64Match) {
                        coverBuffer = Buffer.from(base64Match[1], 'base64');
                        console.log(`[Covers] Using stored base64 cover for book ${bookId}`);
                    }
                } catch (e) {
                    console.error('Failed to decode stored cover:', e);
                }
            }
        }

        if (!coverBuffer) {
            // Return a placeholder or 404? 
            // A 404 is better so client handles fallback
            return NextResponse.json({ error: 'Cover not found' }, { status: 404 });
        }

        // 3. Resize with Sharp
        const processedImage = await sharp(coverBuffer)
            .resize({ width, fit: 'cover' })
            .webp({ quality })
            .toBuffer();

        return new NextResponse(processedImage as any, {
            headers: {
                'Content-Type': 'image/webp',
                'Cache-Control': 'public, max-age=31536000, immutable',
                'Content-Length': processedImage.length.toString()
            }
        });

    } catch (error) {
        console.error('Cover proxy error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
