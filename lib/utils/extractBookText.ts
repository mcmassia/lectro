
import { Book } from '@/lib/db';
import JSZip from 'jszip';
// We'll dynamic import epubjs in the function to avoid SSR issues if any, though utils are usually safe.
// But epubjs depends on window/document usually.

export interface BookSection {
    title: string;
    content: string;
    href: string;
}

export async function extractBookText(book: Book): Promise<BookSection[]> {
    let bookContent: ArrayBuffer;

    if (book.fileBlob) {
        bookContent = await book.fileBlob.arrayBuffer();
    } else if (book.isOnServer && book.filePath) {
        const encodedPath = book.filePath.split('/').map(encodeURIComponent).join('/');
        const response = await fetch(`/api/library/stream/${encodedPath}`);
        if (!response.ok) {
            throw new Error(`Failed to download book from server: ${response.status}`);
        }
        bookContent = await response.arrayBuffer();
    } else {
        throw new Error("No se pudo obtener el contenido del libro (falta blob local y ruta remota).");
    }

    const { default: ePub } = await import('epubjs');
    const bookInstance = ePub(bookContent);
    await bookInstance.ready;

    // @ts-ignore
    const spine = bookInstance.spine;
    const sections: any[] = [];
    // @ts-ignore
    spine.each((section: any) => sections.push(section));

    const zip = await JSZip.loadAsync(bookContent);
    const results: BookSection[] = [];

    for (const item of sections) {
        // Skip obvious non-content
        if (item.href.includes('cover') || item.href.includes('toc') || item.href.includes('nav')) {
            // We might still want them but usually they are poor value for AI
            // Let's keep them but maybe low priority? For now include everything meaningful.
        }

        let text = '';
        const href = item.href;

        try {
            let zipFile = zip.file(href);
            if (!zipFile) {
                // Try removing leading slash
                const cleanHref = href.replace(/^\//, '');
                zipFile = zip.file(cleanHref);
            }
            if (!zipFile) {
                // Try finding by ending (manifest href often relative)
                const files = Object.keys(zip.files);
                const match = files.find(f => f.endsWith(href) || href.endsWith(f));
                if (match) zipFile = zip.file(match);
            }

            if (zipFile) {
                const rawContent = await zipFile.async('string');
                // Basic HTML stripping
                const parser = new DOMParser();
                const doc = parser.parseFromString(rawContent, 'text/html');

                // improve parsing: add spaces between block elements
                // This is a naive strip. 
                text = (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
            }
        } catch (e) {
            console.warn(`Extraction failed for ${href}`, e);
        }

        if (text && text.length > 50) { // arbitrary min length to skip empty pages
            // Try to find a title
            // Getting TOC item from spine Item?
            // Helper to get chapter title if possible
            let title = `Section ${results.length + 1}`;

            results.push({
                title,
                content: text,
                href: item.href
            });
        }
    }

    bookInstance.destroy();
    return results;
}
