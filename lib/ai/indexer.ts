import { db, Book, VectorChunk, addVectorChunks, updateBook } from '@/lib/db';
import { generateEmbeddingAction } from '@/app/actions/ai';
import { v4 as uuid } from 'uuid';
// import ePub from 'epubjs';

// Configuration
const CHUNK_SIZE = 1000; // characters
const CHUNK_OVERLAP = 200;
const RPM_LIMIT = 10; // Gemini Free tier limit (conservative)
const DELAY_BETWEEN_CHUNKS = (60 / RPM_LIMIT) * 1000;

export interface IndexingStatus {
    totalBooks: number;
    processedBooks: number;
    currentBook: string;
    isIndexing: boolean;
    errors: string[];
}

export interface IndexingOptions {
    filter?: {
        type: 'startsWith' | 'titleMatch';
        value: string;
    };
    mode?: 'full' | 'metadata';
}

export class LibraryIndexer {
    private isCancelled = false;
    private onProgress: (status: IndexingStatus) => void;

    constructor(onProgress: (status: IndexingStatus) => void) {
        this.onProgress = onProgress;
    }

    cancel() {
        this.isCancelled = true;
    }

    async indexLibrary(options?: IndexingOptions) {
        if (options?.mode === 'metadata') {
            return this.indexMetadataOnly(options);
        }

        this.isCancelled = false;
        let allBooks = await db.books.toArray();

        // Apply user filter if present
        if (options?.filter?.value) {
            const filterVal = options.filter.value.toLowerCase();
            if (options.filter.type === 'startsWith') {
                if (filterVal !== 'all') {
                    allBooks = allBooks.filter(book =>
                        book.title.toLowerCase().startsWith(filterVal)
                    );
                }
            } else if (options.filter.type === 'titleMatch') {
                allBooks = allBooks.filter(book =>
                    book.title.toLowerCase().includes(filterVal)
                );
            }
        }

        const unindexedBooks = await this.filterUnindexedBooks(allBooks);

        const status: IndexingStatus = {
            totalBooks: unindexedBooks.length,
            processedBooks: 0,
            currentBook: '',
            isIndexing: true,
            errors: []
        };

        this.onProgress(status);

        for (const book of unindexedBooks) {
            if (this.isCancelled) break;

            status.currentBook = book.title;
            this.onProgress({ ...status });

            try {
                let fileBlob = book.fileBlob;

                // If no local blob, try to fetch from server
                if (!fileBlob && (book.filePath || book.fileName)) {
                    try {
                        const pathParam = book.filePath || book.fileName;
                        console.log(`Fetching file for ${book.title} from ${pathParam}`);
                        const url = `/api/library/file/download?path=${encodeURIComponent(pathParam)}`;
                        const res = await fetch(url);
                        if (res.ok) {
                            fileBlob = await res.blob();
                            console.log(`Fetched ${fileBlob.size} bytes for ${book.title}`);
                        } else {
                            console.warn(`Failed to fetch file for ${book.title}: ${res.status}`);
                        }
                    } catch (e) {
                        console.error(`Failed to fetch file for ${book.title}`, e);
                    }
                }

                if (!fileBlob) {
                    throw new Error('No file data available');
                }

                // Create a temporary book object with the blob for processing
                const bookWithBlob = { ...book, fileBlob } as Book;

                const textChunks = await this.extractAndChunkBook(bookWithBlob);
                console.log(`Extracted ${textChunks.length} chunks for ${book.title}`);

                if (textChunks.length === 0) {
                    console.warn(`No text chunks found for book: ${book.title}`);
                    status.errors.push(`Warning: No text extracted from ${book.title}`);
                }

                // Process chunks in batches to respect rate limits
                const chunksAdded = await this.processChunks(book.id, textChunks, status);

                if (chunksAdded === 0 && textChunks.length > 0) {
                    status.errors.push(`Failed to generate embeddings for ${book.title}`);
                }

            } catch (error: any) {
                console.error(`Error indexing book ${book.title}:`, error);
                status.errors.push(`Failed to index ${book.title}: ${error.message}`);
            }

            status.processedBooks++;
            this.onProgress({ ...status });
        }

        status.isIndexing = false;
        status.currentBook = 'Completed';
        this.onProgress({ ...status });
    }

    async indexMetadataOnly(options?: IndexingOptions) {
        this.isCancelled = false;
        let allBooks = await db.books.toArray();

        // Apply filters
        if (options?.filter?.value) {
            const filterVal = options.filter.value.toLowerCase();
            if (options.filter.type === 'startsWith') {
                if (filterVal !== 'all') {
                    allBooks = allBooks.filter(book =>
                        book.title.toLowerCase().startsWith(filterVal)
                    );
                }
            } else if (options.filter.type === 'titleMatch') {
                allBooks = allBooks.filter(book =>
                    book.title.toLowerCase().includes(filterVal)
                );
            }
        }

        const status: IndexingStatus = {
            totalBooks: allBooks.length,
            processedBooks: 0,
            currentBook: '',
            isIndexing: true,
            errors: []
        };
        this.onProgress(status);

        for (const book of allBooks) {
            if (this.isCancelled) break;

            // Rate limiting delay
            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_CHUNKS));

            status.currentBook = book.title;
            this.onProgress({ ...status });

            try {
                // Gather data
                const userBookData = await db.userBookData.where('bookId').equals(book.id).first();
                const xray = await db.xrayData.where('bookId').equals(book.id).first();

                // Build Summary
                let summary = `Título: ${book.title}\nAutor: ${book.author}\n`;
                if (book.metadata?.description) summary += `Descripción: ${book.metadata.description}\n`;
                if (book.metadata?.tags?.length) summary += `Categorías: ${book.metadata.tags.join(', ')}\n`;
                if (userBookData?.userRating) summary += `Valoración Personal: ${userBookData.userRating}\n`;

                if (xray) {
                    summary += `\n-- ADN del Libro --\n`;
                    if (xray.summary) summary += `Resumen: ${xray.summary}\n`;
                    if (xray.characters?.length) summary += `Personajes Clave: ${xray.characters.map(c => c.name).join(', ')}\n`;
                    if (xray.terms?.length) summary += `Temas Clave: ${xray.terms.map(t => t.name).join(', ')}\n`;
                }

                // Generate Embedding
                const result = await generateEmbeddingAction(summary);

                if (result.success && result.embedding) {
                    // Delete old metadata chunk if exists
                    await db.vectorChunks.where('bookId').equals(book.id).filter(c => c.chapterIndex === -999).delete();

                    const chunk: VectorChunk = {
                        id: uuid(),
                        bookId: book.id,
                        chapterIndex: -999, // Metadata marker
                        chapterTitle: 'METADATA_SUMMARY',
                        text: summary,
                        embedding: result.embedding,
                        startCfi: ''
                    };
                    await addVectorChunks([chunk]);
                } else {
                    status.errors.push(`Failed to generate metadata embedding for ${book.title}`);
                }

            } catch (e: any) {
                console.error(`Error indexing metadata for ${book.title}`, e);
                status.errors.push(`Error: ${e.message}`);
            }

            status.processedBooks++;
            this.onProgress({ ...status });
        }

        status.isIndexing = false;
        status.currentBook = 'Completed (Metadata)';
        this.onProgress({ ...status });
    }

    private async filterUnindexedBooks(books: Book[]): Promise<Book[]> {
        const unindexed: Book[] = [];
        for (const book of books) {
            const count = await db.vectorChunks.where('bookId').equals(book.id).count();
            if (count === 0) {
                unindexed.push(book);
            }
        }
        return unindexed;
    }

    private async extractAndChunkBook(book: Book): Promise<{ text: string, chapterTitle: string, cfi: string }[]> {
        console.log(`Extracting text for ${book.title} (${book.format})`);

        try {
            if (book.format === 'epub') {
                return this.processEpub(book.fileBlob);
            } else if (book.format === 'pdf') {
                return this.processPdf(book.fileBlob);
            } else {
                console.warn(`Unsupported format: ${book.format} for ${book.title}`);
                return [];
            }
        } catch (e) {
            console.error(`Extraction failed for ${book.title}:`, e);
            return [];
        }
    }

    private async processPdf(blob: Blob): Promise<{ text: string, chapterTitle: string, cfi: string }[]> {
        try {
            const arrayBuffer = await blob.arrayBuffer();
            const pdfjsCount = await import('pdfjs-dist');

            if (!pdfjsCount.GlobalWorkerOptions.workerSrc) {
                pdfjsCount.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsCount.version}/build/pdf.worker.min.mjs`;
            }

            const pdf = await pdfjsCount.getDocument({ data: arrayBuffer }).promise;

            const chunks: { text: string, chapterTitle: string, cfi: string }[] = [];

            for (let i = 1; i <= pdf.numPages; i++) {
                if (this.isCancelled) break;

                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map((item: any) => item.str).join(' ');

                if (pageText.length > 50) {
                    const pageChunks = this.splitText(pageText);
                    pageChunks.forEach(chunk => {
                        chunks.push({
                            text: chunk,
                            chapterTitle: `Page ${i}`,
                            cfi: `page_${i}` // Pseudo-CFI for PDF
                        });
                    });
                }
            }
            return chunks;

        } catch (e) {
            console.error("PDF Processing Error", e);
            return [];
        }
    }

    private async processEpub(blob: Blob): Promise<{ text: string, chapterTitle: string, cfi: string }[]> {
        const arrayBuffer = await blob.arrayBuffer();
        const ePub = (await import('epubjs')).default;
        const book = ePub(arrayBuffer);
        await book.ready;

        const chunks: { text: string, chapterTitle: string, cfi: string }[] = [];

        // @ts-ignore
        const spine = book.spine as any;
        const sections: any[] = [];

        spine.each((section: any) => {
            sections.push(section);
        });

        console.log(`EPUB has ${sections.length} sections for processing`);

        for (const item of sections) {
            if (this.isCancelled) break;

            try {
                const doc = await item.load(book.load.bind(book));
                const tempDiv = document.createElement('div');

                if (doc instanceof Document) {
                    const root = doc.body || doc.documentElement;
                    if (root) {
                        tempDiv.innerHTML = root.innerHTML;
                    }
                } else if (typeof doc === 'string') {
                    tempDiv.innerHTML = doc;
                }

                tempDiv.style.position = 'absolute';
                tempDiv.style.left = '-9999px';
                tempDiv.style.visibility = 'hidden';
                document.body.appendChild(tempDiv);

                let text = (tempDiv.innerText || tempDiv.textContent || '')
                    .replace(/\s+/g, ' ')
                    .trim();

                document.body.removeChild(tempDiv);

                if (!text) {
                    if (doc instanceof Document) {
                        const root = doc.body || doc.documentElement;
                        if (root && root.textContent) {
                            text = root.textContent.replace(/\s+/g, ' ').trim();
                        }
                    }
                }

                if (text.length > 50) {
                    const textParts = this.splitText(text);

                    textParts.forEach((part, index) => {
                        chunks.push({
                            text: part,
                            chapterTitle: item.href,
                            cfi: item.cfiBase
                        });
                    });
                }

                item.unload();
            } catch (e: any) {
                console.error('Error processing chapter:', e);
            }
        }

        book.destroy();
        return chunks;
    }

    private splitText(text: string): string[] {
        const chunks: string[] = [];
        for (let i = 0; i < text.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
            chunks.push(text.slice(i, i + CHUNK_SIZE));
        }
        return chunks;
    }

    private async processChunks(bookId: string, chunks: { text: string, chapterTitle: string, cfi: string }[], status: IndexingStatus): Promise<number> {
        const vectorChunks: VectorChunk[] = [];
        let totalAdded = 0;

        for (const chunk of chunks) {
            if (this.isCancelled) break;

            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_CHUNKS));

            const result = await generateEmbeddingAction(chunk.text);

            if (result.success && result.embedding) {
                vectorChunks.push({
                    id: uuid(),
                    bookId: bookId,
                    chapterIndex: 0,
                    chapterTitle: chunk.chapterTitle,
                    text: chunk.text,
                    embedding: result.embedding,
                    startCfi: chunk.cfi
                });
            } else {
                console.warn('Failed to generate embedding for chunk', result.error);
                if (!status.errors.includes(`Embedding error: ${result.error}`)) {
                    status.errors.push(`Embedding error: ${result.error}`);
                    this.onProgress({ ...status });
                }
            }

            if (vectorChunks.length >= 5) {
                await addVectorChunks(vectorChunks);
                totalAdded += vectorChunks.length;
                vectorChunks.length = 0;
            }
        }

        if (vectorChunks.length > 0) {
            await addVectorChunks(vectorChunks);
            totalAdded += vectorChunks.length;
        }

        return totalAdded;
    }
}
