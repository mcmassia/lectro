import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';

const CONFIG_FILE = path.join(process.cwd(), 'server-config.json');

function getLibraryPath(): string {
    if (process.env.LECTRO_LIBRARY_PATH) return process.env.LECTRO_LIBRARY_PATH;
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
            if (config.libraryPath) return config.libraryPath;
        }
    } catch (e) { }
    return path.join(process.cwd(), 'library');
}

const CACHE_DIR_NAME = '_cache';

interface ReadiumLink {
    href: string;
    type: string;
    rel?: string;
    height?: number;
    width?: number;
    title?: string;
}

interface ReadiumManifest {
    '@context': string;
    metadata: any;
    links: ReadiumLink[];
    readingOrder: ReadiumLink[];
    resources?: ReadiumLink[];
    toc?: ReadiumLink[];
}

export class ReadiumHelper {
    private bookId: string;
    private libraryPath: string;
    private cachePath: string;

    constructor(bookId: string) {
        this.bookId = bookId;
        this.libraryPath = getLibraryPath();
        this.cachePath = path.join(this.libraryPath, CACHE_DIR_NAME, bookId);
    }

    private getBookPath(): string | null {
        try {
            const dbPath = path.join(this.libraryPath, 'lectro_data.json');
            console.log(`[Readium] Looking for DB at: ${dbPath}`);

            if (!fs.existsSync(dbPath)) {
                console.error(`[Readium] DB not found at ${dbPath}`);
                return null;
            }

            const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
            const book = data.books?.find((b: any) => b.id === this.bookId);

            if (!book) {
                console.error(`[Readium] Book ${this.bookId} not found in DB`);
                return null;
            }
            if (!book.filePath) {
                console.error(`[Readium] Book ${this.bookId} has no filePath`);
                return null;
            }

            const rawPath = path.join(this.libraryPath, book.filePath);

            // Try different normalizations (NFC, NFD) to handle OS/Browser mismatches
            const candidates = [
                rawPath,
                rawPath.normalize('NFC'),
                rawPath.normalize('NFD')
            ];

            for (const candidate of candidates) {
                if (fs.existsSync(candidate)) {
                    console.log(`[Readium] Resolved path: ${candidate}`);
                    return candidate;
                }
            }

            console.error(`[Readium] File does not exist at ${rawPath} (tried all normalizations)`);
            return null;


        } catch (e) {
            console.error('[Readium] Error resolving book path:', e);
            return null;
        }
    }

    public isUnzipped(): boolean {
        // Check if unzipped dir exists and has container.xml
        return fs.existsSync(path.join(this.cachePath, 'META-INF', 'container.xml'));
    }

    public unzip(): void {
        const filePath = this.getBookPath();
        if (!filePath || !fs.existsSync(filePath)) {
            throw new Error('Book file not found');
        }

        console.log(`[Readium] Unzipping book ${this.bookId}`);
        console.log(`[Readium] Source path: ${filePath}`);
        console.log(`[Readium] Target path: ${this.cachePath}`);

        // Ensure cache base dir exists
        const baseCache = path.join(this.libraryPath, CACHE_DIR_NAME);
        if (!fs.existsSync(baseCache)) fs.mkdirSync(baseCache, { recursive: true });

        // Unzip
        const zip = new AdmZip(filePath);
        zip.extractAllTo(this.cachePath, true); // overwrite = true
    }

    public getManifest(): ReadiumManifest {
        try {
            // 1. Ensure unzipped
            if (!this.isUnzipped()) {
                this.unzip();
            }

            // 2. Parse OPF
            // A. Find OPF Path from container.xml
            const containerPath = path.join(this.cachePath, 'META-INF', 'container.xml');
            if (!fs.existsSync(containerPath)) {
                throw new Error(`container.xml not found at ${containerPath}`);
            }

            const containerXml = fs.readFileSync(containerPath, 'utf8');
            // More flexible regex for full-path attribute (supports single/double quotes, spaces)
            const opfMatch = containerXml.match(/full-path\s*=\s*["']([^"']+)["']/);
            if (!opfMatch) {
                console.error(`[Readium] Invalid container.xml content for book ${this.bookId}:`, containerXml);
                throw new Error('Invalid container.xml: full-path not found');
            }
            const opfRelPath = opfMatch[1];
            const opfPath = path.join(this.cachePath, opfRelPath);

            if (!fs.existsSync(opfPath)) {
                console.error(`[Readium] OPF file not found at ${opfPath} (rel: ${opfRelPath})`);
                throw new Error(`OPF file not found: ${opfRelPath}`);
            }

            const opfDir = path.dirname(opfRelPath); // relative to root
            const opfContent = fs.readFileSync(opfPath, 'utf8');

            // B. Extract Metadata
            const titleMatch = opfContent.match(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/i);
            const authorMatch = opfContent.match(/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/i);

            const metadata = {
                '@type': 'http://schema.org/Book',
                title: titleMatch ? titleMatch[1].trim() : 'Unknown Title',
                author: authorMatch ? authorMatch[1].trim() : 'Unknown Author',
                identifier: `urn:lectro:${this.bookId}`
            };

            // C. Parse Manifest Items
            const items: Record<string, { href: string; mediaType: string }> = {};
            const itemRegex = /<item\s+([^>]+)\/>/gi;
            let match;
            while ((match = itemRegex.exec(opfContent)) !== null) {
                const attrs = match[1];
                const idMatch = attrs.match(/id\s*=\s*["']([^"']+)["']/i);
                const hrefMatch = attrs.match(/href\s*=\s*["']([^"']+)["']/i);
                const mediaTypeMatch = attrs.match(/media-type\s*=\s*["']([^"']+)["']/i);

                if (idMatch && hrefMatch && mediaTypeMatch) {
                    items[idMatch[1]] = {
                        href: hrefMatch[1],
                        mediaType: mediaTypeMatch[1]
                    };
                }
            }

            // D. Parse Spine
            const readingOrder: ReadiumLink[] = [];
            const spineRegex = /<itemref\s+idref\s*=\s*["']([^"']+)["']/gi;
            while ((match = spineRegex.exec(opfContent)) !== null) {
                const idref = match[1];
                const item = items[idref];
                if (item) {
                    // Path resolution:
                    // opfDir might be "." if OPF is at root. 
                    // If opfDir is "OEBPS", and item.href is "Text/chap1.xhtml", fullPath = "OEBPS/Text/chap1.xhtml"
                    const fullPath = opfDir === '.' ? item.href : path.join(opfDir, item.href);

                    // Ensure forward slashes for URL
                    const urlPath = fullPath.split(path.sep).join('/');

                    // Preserve slashes so browser can resolve relative paths (e.g. ../Images/foo.jpg)
                    const resourceUrl = `/api/readium/${this.bookId}/resource/${urlPath.split('/').map(encodeURIComponent).join('/')}`;

                    readingOrder.push({
                        href: resourceUrl,
                        type: item.mediaType
                    });
                }
            }

            // E. Parse TOC (NCX or Nav Doc)
            const toc: ReadiumLink[] = [];

            // 1. Try to find NCX (EPUB 2)
            // Look for item with type application/x-dtbncx+xml
            const ncxId = Object.keys(items).find(id => items[id].mediaType === 'application/x-dtbncx+xml');
            if (ncxId) {
                const ncxItem = items[ncxId];
                const ncxFullPath = opfDir === '.' ? ncxItem.href : path.join(opfDir, ncxItem.href);
                const ncxPath = path.join(this.cachePath, ncxFullPath);

                if (fs.existsSync(ncxPath)) {
                    const ncxContent = fs.readFileSync(ncxPath, 'utf8');
                    // Simple regex for top-level navPoints
                    // Note: Recursive parsing with regex is hard. We'll do flat or 1-level for now.
                    // Better: use a proper recursive function on the string content if possible, or reliable regex loop.

                    const navPointRegex = /<navPoint[^>]+playOrder="([^"]+)"[^>]*>([\s\S]*?)<\/navPoint>/gi;
                    let match;
                    while ((match = navPointRegex.exec(ncxContent)) !== null) {
                        const content = match[2];
                        const labelMatch = content.match(/<text>([\s\S]*?)<\/text>/i);
                        const srcMatch = content.match(/<content\s+src="([^"]+)"/i);

                        if (labelMatch && srcMatch) {
                            // src is relative to NCX file.
                            // We need to resolve it relative to book root, then encode for API.
                            // ncxFullPath is path/to/toc.ncx
                            const ncxDir = path.dirname(ncxFullPath);
                            const src = srcMatch[1];

                            // Resolve logic:
                            const targetPath = ncxDir === '.' ? src : path.join(ncxDir, src);
                            const urlPath = targetPath.split(path.sep).join('/');

                            toc.push({
                                href: `/api/readium/${this.bookId}/resource/${urlPath.split('/').map(encodeURIComponent).join('/')}`,
                                title: labelMatch[1].trim(),
                                type: 'application/xhtml+xml' // Assumption
                            });
                        }
                    }
                }
            }

            // Sort by playOrder? Regex iteration usually follows document order.

            if (readingOrder.length === 0) {
                console.warn(`[Readium] No reading order found for book ${this.bookId}. Check OPF parsing.`);
            }

            return {
                '@context': 'https://readium.org/webpub-manifest/context.jsonld',
                metadata,
                links: [
                    { href: `/api/readium/${this.bookId}/manifest`, type: 'application/webpub+json', rel: 'self' }
                ],
                readingOrder,
                toc: toc.length > 0 ? toc : undefined
            };
        } catch (error) {
            console.error(`[Readium] Failed to generate manifest for ${this.bookId}:`, error);
            throw error;
        }
    }
}
