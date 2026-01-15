import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';

const CONFIG_FILE = path.join(process.cwd(), 'server-config.json');

function getLibraryPath(): string {
    if (process.env.LIBRARY_PATH) return process.env.LIBRARY_PATH;
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
        const dbPath = path.join(this.libraryPath, 'lectro_data.json');
        if (!fs.existsSync(dbPath)) return null;

        try {
            const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
            const book = data.books?.find((b: any) => b.id === this.bookId);
            if (!book || !book.filePath) return null;
            return path.join(this.libraryPath, book.filePath);
        } catch {
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

        console.log(`[Readium] Unzipping book ${this.bookId} to ${this.cachePath}`);

        // Ensure cache base dir exists
        const baseCache = path.join(this.libraryPath, CACHE_DIR_NAME);
        if (!fs.existsSync(baseCache)) fs.mkdirSync(baseCache, { recursive: true });

        // Unzip
        const zip = new AdmZip(filePath);
        zip.extractAllTo(this.cachePath, true); // overwrite = true
    }

    public getManifest(): ReadiumManifest {
        // 1. Ensure unzipped
        if (!this.isUnzipped()) {
            this.unzip();
        }

        // 2. Parse OPF
        // A. Find OPF Path from container.xml
        const containerPath = path.join(this.cachePath, 'META-INF', 'container.xml');
        const containerXml = fs.readFileSync(containerPath, 'utf8');
        const opfMatch = containerXml.match(/full-path="([^"]+)"/);
        if (!opfMatch) throw new Error('Invalid container.xml');
        const opfRelPath = opfMatch[1];
        const opfPath = path.join(this.cachePath, opfRelPath);
        const opfDir = path.dirname(opfRelPath); // relative to root

        const opfContent = fs.readFileSync(opfPath, 'utf8');

        // B. Extract Metadata (Title, Author) - Simplified regex parsing for MVP
        // A real XML parser (xmldom) would be safer but heavier.
        const titleMatch = opfContent.match(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/);
        const authorMatch = opfContent.match(/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/);

        const metadata = {
            '@type': 'http://schema.org/Book',
            title: titleMatch ? titleMatch[1] : 'Unknown',
            author: authorMatch ? authorMatch[1] : 'Unknown',
            identifier: `urn:lectro:${this.bookId}`
        };

        // C. Parse Manifest Items
        const items: Record<string, { href: string; mediaType: string }> = {};
        const itemRegex = /<item\s+([^>]+)\/>/g;
        let match;
        while ((match = itemRegex.exec(opfContent)) !== null) {
            const attrs = match[1];
            const idMatch = attrs.match(/id="([^"]+)"/);
            const hrefMatch = attrs.match(/href="([^"]+)"/);
            const mediaTypeMatch = attrs.match(/media-type="([^"]+)"/);

            if (idMatch && hrefMatch && mediaTypeMatch) {
                items[idMatch[1]] = {
                    href: hrefMatch[1],
                    mediaType: mediaTypeMatch[1]
                };
            }
        }

        // D. Parse Spine (Reading Order)
        const readingOrder: ReadiumLink[] = [];
        const spineRegex = /<itemref\s+idref="([^"]+)"/g;
        while ((match = spineRegex.exec(opfContent)) !== null) {
            const idref = match[1];
            const item = items[idref];
            if (item) {
                // Hrefs in manifest must be relative to the manifest file URL?
                // Or absolute? 
                // In Readium Web Publication, resources are typically relative to the manifest.
                // But our files are inside a subfolder structure (maybe). 
                // If OPF is in OEBPS/, and item is Text/chap1.xhtml, the link should be OEBPS/Text/chap1.xhtml?
                // No, usually OPF defines resources relative to itself. 
                // Readium Manifest usually served from root? 
                // Let's assume we serve manifest from /api/readium/[id]/manifest
                // And resources from /api/readium/[id]/resource/...

                // We need to construct the URL for the resource.
                // Let's make it easy: href = `../resource/${opfDir}/${item.href}`? 
                // Or if opfDir is empty, `../resource/${item.href}`

                // Correct logic:
                // The resource path relative to the book root is `path.join(opfDir, item.href)`.
                // Our Resource API expects the path relative to book root.

                const fullPath = opfDir === '.' ? item.href : `${opfDir}/${item.href}`;

                // Readium WebPub Manifest hrefs should be URI-escaped.
                // And usually relative to the manifest.
                // If manifest is at `/manifest`, a resource at `/resource/foo.html` should be linked as `../resource/foo.html`?
                // Or absolute URI. Let's use absolute path relative to server root? 
                // Readium implies relative to manifest.
                // Let's use a special protocol or just relative path if we structure routes well.
                // Let's try absolute URL path for now: `/api/readium/${this.bookId}/resource/${fullPath}`

                readingOrder.push({
                    href: `/api/readium/${this.bookId}/resource/${fullPath}`,
                    type: item.mediaType
                });
            }
        }

        // E. Resources (Everything else + fonts + css)
        // For MVP, maybe we don't list all resources in 'resources', Readium engine might fetch them if referenced in HTML.
        // But usually fonts/css should be listed.

        return {
            '@context': 'https://readium.org/webpub-manifest/context.jsonld',
            metadata,
            links: [
                { href: `/api/readium/${this.bookId}/manifest`, type: 'application/webpub+json', rel: 'self' }
            ],
            readingOrder,
            // resources: [...] // Fill later if needed
        };
    }
}
