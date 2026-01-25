import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { v4 as uuidv4 } from 'uuid';

import { getLibraryPath } from '@/lib/server/config';

// getLibraryPath removed (use import)


// Helper to extract metadata from EPUB using adm-zip directly
function extractEpubMetadata(filePath: string): any {
    try {
        const zip = new AdmZip(filePath);
        const containerEntry = zip.getEntry('META-INF/container.xml');
        if (!containerEntry) return null;

        const containerXml = containerEntry.getData().toString('utf8');
        const opfMatch = containerXml.match(/full-path\s*=\s*["']([^"']+)["']/);
        if (!opfMatch) return null;

        const opfRelPath = opfMatch[1];
        const opfEntry = zip.getEntry(opfRelPath);
        if (!opfEntry) return null;

        const opfContent = opfEntry.getData().toString('utf8');

        const titleMatch = opfContent.match(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/i);
        const authorMatch = opfContent.match(/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/i);

        // Simple regex for language and description
        const langMatch = opfContent.match(/<dc:language[^>]*>([\s\S]*?)<\/dc:language>/i);
        const descMatch = opfContent.match(/<dc:description[^>]*>([\s\S]*?)<\/dc:description>/i);

        return {
            title: titleMatch ? titleMatch[1].trim() : path.basename(filePath, '.epub'),
            author: authorMatch ? authorMatch[1].trim() : 'Unknown Author',
            language: langMatch ? langMatch[1].trim() : 'en',
            description: descMatch ? descMatch[1].trim() : undefined
        };
    } catch (e) {
        console.warn(`Failed to parse EPUB metadata for ${filePath}:`, e);
        return null;
    }
}

export async function POST(req: NextRequest) {
    try {
        const libraryPath = getLibraryPath();
        console.log(`[Discovery] Starting discovery in: ${libraryPath}`);

        const dbPath = path.join(libraryPath, 'lectro_data.json');

        let data = { books: [] };
        if (fs.existsSync(dbPath)) {
            data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        }

        const existingPaths = new Set<string>();
        // Normalize checking
        data.books.forEach((b: any) => {
            if (b.filePath) existingPaths.add(b.filePath);
            if (b.fileName) existingPaths.add(b.fileName);
            // Also add absolute versions
            if (b.filePath) existingPaths.add(path.join(libraryPath, b.filePath));
        });

        const newBooks: any[] = [];
        const filesFound: string[] = [];

        // Recursive scan
        const scanDir = (dir: string) => {
            const list = fs.readdirSync(dir);
            for (const file of list) {
                const fullPath = path.join(dir, file);
                const stat = fs.statSync(fullPath);

                if (stat && stat.isDirectory()) {
                    // Avoid hidden dirs or cache
                    if (file.startsWith('.') || file === '_cache') continue;
                    scanDir(fullPath);
                } else {
                    const ext = path.extname(file).toLowerCase();
                    if (ext === '.epub' || ext === '.pdf') {
                        const relPath = path.relative(libraryPath, fullPath); // Used for DB filePath

                        // Check strictly
                        // Use both relPath and full filename 
                        if (existingPaths.has(relPath) || existingPaths.has(file) || existingPaths.has(fullPath)) {
                            continue;
                        }

                        filesFound.push(fullPath);
                    }
                }
            }
        };

        scanDir(libraryPath);
        console.log(`[Discovery] Scanned. Found ${filesFound.length} potential new files.`);

        // Process new files
        for (const filePath of filesFound) {
            const ext = path.extname(filePath).toLowerCase();
            const relPath = path.relative(libraryPath, filePath);
            const fileName = path.basename(filePath);

            let metadata = {
                title: path.basename(fileName, ext),
                author: 'Unknown Author'
            };

            if (ext === '.epub') {
                const parsed = extractEpubMetadata(filePath);
                if (parsed) {
                    metadata = parsed;
                }
            }

            // For PDF, we can only guess title from filename easily on server side without heavy libs

            const newBook = {
                id: uuidv4(),
                title: metadata.title,
                author: metadata.author,
                description: (metadata as any).description,
                language: (metadata as any).language,
                format: ext.substring(1),
                fileName: fileName,
                filePath: relPath, // Valid relative path
                fileSize: fs.statSync(filePath).size,
                addedAt: new Date().toISOString(),
                isOnServer: true,
                status: 'unread'
                // cover: undefined (Client will generate or we generate explicitly later? Server side cover is hard without specialized tools or unzip. Readium API endpoints can serve cover on demand!)
            };

            newBooks.push(newBook);
        }

        if (newBooks.length > 0) {
            console.log(`[Discovery] Adding ${newBooks.length} new books to DB.`);

            // Append
            // @ts-ignore
            data.books = [...(data.books || []), ...newBooks];

            fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
        }

        return NextResponse.json({
            success: true,
            addedCount: newBooks.length,
            addedBooks: newBooks
        });

    } catch (error) {
        console.error('Discovery failed:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
