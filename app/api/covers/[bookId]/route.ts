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
        const version = req.nextUrl.searchParams.get('v'); // Cache busting/immutable version

        const libraryPath = getLibraryPath();
        const dbPath = path.join(libraryPath, 'lectro_data.json');

        // CACHE SETUP
        // We use a subfolder in the library path to store cached covers
        // Structure: [LibraryPath]/.lectro/cache/covers
        const cacheDir = path.join(libraryPath, '.lectro', 'cache', 'covers');
        // Include width/quality in filename to distinct sizes
        // We use bookId + params as key
        const cacheKey = `${bookId}_w${width}_q${quality}.webp`;
        const cachePath = path.join(cacheDir, cacheKey);

        // 1. CHECK CACHE
        // If we have a cached file, serve it directly
        if (fs.existsSync(cachePath)) {
            try {
                // If version is provided, we can assume it matches data (client responsibility)
                // But generally file existence is enough if we invalidate on update?
                // For now, simple file existence. If book updates, client sends new 'v', 
                // but we might serve old cache if we don't check timestamp?
                // Ideally we should check if cache is older than book.updatedAt? 
                // But that requires DB read. Let's do DB read anyway as it is fast (JSON/Memory).
                // Actually, to be super fast, let's just serve cache. 
                // Correct invalidation: If book updates, we should probably delete its cache.
                // For now: Lazy invalidation. If client requests v=NEW_TIMESTAMP, we can't easily know if cache is old 
                // without DB. 
                // Let's rely on DB check for existence/security anyway, then we can check timestamp.

                // OPTIMIZATION: serve directly if exists? 
                // Security: Is random access to this file OK? It's just a cover image.
                // But we should verify book exists to prevent garbage accumulation or access to deleted?
                // Let's stick to the flow: Check DB -> Check Cache -> Serve/Generate.
            } catch (e) {
                // ignore
            }
        }

        if (!fs.existsSync(dbPath)) {
            return NextResponse.json({ error: 'Library DB not found' }, { status: 404 });
        }

        // 2. Load DB (This handles auth/existence implicitly by being local)
        // Optimization: In a real DB this is a query. Here it's a big JSON read. 
        // We might want to optimize this read in the future, but for now it's necessary.
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        const book = data.books?.find((b: any) => b.id === bookId);

        if (!book || (!book.filePath && !book.fileName && !book.cover)) {
            return NextResponse.json({ error: 'Book not found on server' }, { status: 404 });
        }

        // 3. VALIDATE CACHE ACROSS UPDATE
        // If cache exists, check if it is stale compared to book.updatedAt
        // If book.updatedAt is newer than cache mtime, we should regenerate.
        let serveFromCache = false;
        if (fs.existsSync(cachePath)) {
            const cacheStats = fs.statSync(cachePath);
            const bookUpdated = new Date(book.updatedAt || 0).getTime();
            const cacheCreated = cacheStats.mtime.getTime();

            // If cache is newer or same age as book update, it is valid
            if (cacheCreated >= bookUpdated) {
                serveFromCache = true;
            }
        }

        // Setup Cache Control Headers
        // If 'v' matches book.updatedAt (roughly), we can permit long cache
        // If no 'v', we use shorter cache.
        const cacheControl = version
            ? 'public, max-age=31536000, immutable'
            : 'public, max-age=3600, must-revalidate';

        if (serveFromCache) {
            const cachedBuffer = fs.readFileSync(cachePath);
            return new NextResponse(cachedBuffer as any, {
                headers: {
                    'Content-Type': 'image/webp',
                    'Cache-Control': cacheControl,
                    'Content-Length': cachedBuffer.length.toString()
                }
            });
        }

        // --- GENERATION START ---

        // PRIORITY 1: Check if book record has a user-saved cover (URL or base64) - this takes precedence
        // We check this FIRST before even looking for the file, since we don't need the file if we have a cover URL
        let coverBuffer: Buffer | null = null;

        if (book.cover && typeof book.cover === 'string') {
            // Check for external URL (http/https) - like Google Books covers
            if (book.cover.startsWith('http://') || book.cover.startsWith('https://')) {
                try {
                    console.log(`[Covers] Fetching saved cover URL for book ${bookId}: ${book.cover}`);
                    const response = await fetch(book.cover);
                    if (response.ok) {
                        const arrayBuffer = await response.arrayBuffer();
                        coverBuffer = Buffer.from(arrayBuffer);
                        console.log(`[Covers] Successfully fetched saved cover URL for book ${bookId}`);
                    } else {
                        console.error(`[Covers] Failed to fetch saved cover URL: ${response.status}`);
                    }
                } catch (e) {
                    console.error('Failed to fetch saved cover URL:', e);
                }
            }
            // Check for base64 data URL
            else if (book.cover.startsWith('data:image')) {
                try {
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

        // If no user-saved cover, try file extraction
        if (!coverBuffer) {
            // ... existing file extraction logic ...
            let filePath = '';
            if (book.filePath) {
                filePath = path.join(libraryPath, book.filePath);
            }

            // Fallback: If filePath is missing or file doesn't exist, try to find it by fileName
            if (!filePath || !fs.existsSync(filePath)) {
                if (book.fileName) {
                    const fallbackPath = path.join(libraryPath, book.fileName);
                    if (fs.existsSync(fallbackPath)) {
                        filePath = fallbackPath;
                    }
                }
            }

            // If file found, try to extract
            if (filePath && fs.existsSync(filePath)) {
                // PRIORITY 2: Check for external cover file in the same directory (cover.jpg, cover.png, cover.webp)
                const bookDir = path.dirname(filePath);
                const coverExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif'];

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
                                else if (zip.getEntry('OEBPS/cover.jpg')) coverHref = 'OEBPS/cover.jpg';
                            }
                        }

                        if (coverHref) {
                            // Resolve path
                            const fullCoverPath = opfDir === '.' ? coverHref : path.join(opfDir, coverHref).replace(/\\/g, '/');
                            const coverEntry = zip.getEntry(fullCoverPath);
                            if (coverEntry) {
                                coverBuffer = coverEntry.getData();
                            } else {
                                const decodedPath = decodeURIComponent(fullCoverPath);
                                const coverEntryDecoded = zip.getEntry(decodedPath);
                                if (coverEntryDecoded) coverBuffer = coverEntryDecoded.getData();
                            }
                        }

                    } catch (e) {
                        console.error('EPUB extraction failed:', e);
                    }
                }
            }
        }

        if (!coverBuffer) {
            return NextResponse.json({ error: 'Cover not found' }, { status: 404 });
        }

        // Resize with Sharp
        const processedImage = await sharp(coverBuffer)
            .resize({ width, fit: 'cover' })
            .webp({ quality })
            .toBuffer();

        // SAVE TO CACHE
        try {
            if (!fs.existsSync(cacheDir)) {
                fs.mkdirSync(cacheDir, { recursive: true });
            }
            fs.writeFileSync(cachePath, processedImage);
            console.log(`[Covers] Cached cover for ${bookId} at ${cachePath}`);
        } catch (e) {
            console.error('Failed to write cover cache:', e);
        }

        return new NextResponse(processedImage as any, {
            headers: {
                'Content-Type': 'image/webp',
                'Cache-Control': cacheControl, // Use the same optimized header
                'Content-Length': processedImage.length.toString()
            }
        });

    } catch (error) {
        console.error('Cover proxy error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
