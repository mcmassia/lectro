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

export class LibraryIndexer {
    private isCancelled = false;
    private onProgress: (status: IndexingStatus) => void;

    constructor(onProgress: (status: IndexingStatus) => void) {
        this.onProgress = onProgress;
    }

    cancel() {
        this.isCancelled = true;
    }

    async indexLibrary() {
        this.isCancelled = false;
        const allBooks = await db.books.toArray();
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
                        // Use a dummy filename 'download' as the route requires [filename], but we rely on the query param
                        const url = `/api/library/file/download?path=${encodeURIComponent(pathParam)}`;
                        const res = await fetch(url);
                        if (res.ok) {
                            fileBlob = await res.blob();
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
        if (book.format === 'epub') {
            return this.processEpub(book.fileBlob);
        } else {
            // PDF support to be added
            // For now return empty or simple text
            return [];
        }
    }

    private async processEpub(blob: Blob): Promise<{ text: string, chapterTitle: string, cfi: string }[]> {
        const arrayBuffer = await blob.arrayBuffer();
        const ePub = (await import('epubjs')).default;
        const book = ePub(arrayBuffer);
        await book.ready;

        const chunks: { text: string, chapterTitle: string, cfi: string }[] = [];

        // Iterate over spine items (chapters)
        // Iterate over spine items (chapters)
        // @ts-ignore
        const spine = book.spine as any;
        const sections: any[] = [];

        // Use the public API to iterate sections ensures we get initialized Section objects
        spine.each((section: any) => {
            sections.push(section);
        });

        for (const item of sections) {
            if (this.isCancelled) break;

            try {
                const doc = await item.load(book.load.bind(book));
                // Extract text content
                // This is a simplification. Ideally we traverse the DOM to get CFIs for paragraphs.
                // For this implementation, we'll get full text of chapter and chunk it, 
                // assigning chapter CFI as start.

                // We need to parse the HTML properly
                const tempDiv = document.createElement('div');

                if (doc instanceof Document) {
                    // Start with body if available (HTML), else documentElement (XHTML/XML)
                    const root = doc.body || doc.documentElement;
                    if (root) {
                        tempDiv.innerHTML = root.innerHTML;
                    }
                } else if (typeof doc === 'string') {
                    tempDiv.innerHTML = doc;
                }

                // Append to body to ensure innerText works (Safari/some browsers issue with detached nodes)
                tempDiv.style.position = 'absolute';
                tempDiv.style.left = '-9999px';
                tempDiv.style.visibility = 'hidden';
                document.body.appendChild(tempDiv);

                // Get text - prefer innerText for layout awareness, fallback to textContent
                let text = (tempDiv.innerText || tempDiv.textContent || '')
                    .replace(/\s+/g, ' ')
                    .trim();

                // Cleanup
                document.body.removeChild(tempDiv);

                if (!text) {
                    // Try fallback to simple textContent on root if detached extraction failed
                    if (doc instanceof Document) {
                        const root = doc.body || doc.documentElement;
                        if (root && root.textContent) {
                            // Use raw text content if innerText failed
                            text = root.textContent.replace(/\s+/g, ' ').trim();
                        }
                    }
                }

                if (text.length > 50) { // arbitrary min length to skip empty/nav pages
                    // Split into chunks
                    const textParts = this.splitText(text);

                    textParts.forEach((part, index) => {
                        chunks.push({
                            text: part,
                            chapterTitle: item.href, // Or try to find TOC title
                            cfi: item.cfiBase // Approximate CFI
                        });
                    });
                }

                // Unload to free memory
                item.unload();
            } catch (e: any) {
                console.error('Error processing chapter:', e);
                // We might want to see this in UI if all fail
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

            // Rate limiting delay
            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_CHUNKS));

            const result = await generateEmbeddingAction(chunk.text);

            if (result.success && result.embedding) {
                vectorChunks.push({
                    id: uuid(),
                    bookId: bookId,
                    chapterIndex: 0, // We could track this
                    chapterTitle: chunk.chapterTitle,
                    text: chunk.text,
                    embedding: result.embedding,
                    startCfi: chunk.cfi
                });
            } else {
                console.warn('Failed to generate embedding for chunk', result.error);
                // Don't spam errors but maybe add one generic one
                if (!status.errors.includes(`Embedding error: ${result.error}`)) {
                    status.errors.push(`Embedding error: ${result.error}`);
                    this.onProgress({ ...status });
                }
            }

            // Save in batches of 5 to avoid memory issues but not too frequent DB writes
            if (vectorChunks.length >= 5) {
                await addVectorChunks(vectorChunks);
                totalAdded += vectorChunks.length;
                vectorChunks.length = 0;
            }
        }

        // Save remaining
        if (vectorChunks.length > 0) {
            await addVectorChunks(vectorChunks);
            totalAdded += vectorChunks.length;
        }

        return totalAdded;
    }
}
