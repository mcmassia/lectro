'use client';

import { v4 as uuidv4 } from 'uuid';
import { Annotation, HighlightColor, db, getAllBooks, Book } from '../db';

// ===================================
// Types
// ===================================

export interface ImportedNote {
    bookTitle: string;
    chapter?: string;
    position?: number;
    readerUrl?: string;
    quote: string;
    note?: string;
    color?: string;
    date?: Date;
}

export interface ImportResult {
    success: boolean;
    imported: number;
    skipped: number;
    errors: string[];
    annotations: Annotation[];
}

// ===================================
// CSV Parser (BookFusion format)
// ===================================

/**
 * Parse BookFusion CSV export
 * Format: Title,Chapter,Position,Reader URL,Quote
 */
export function parseBookFusionCSV(content: string): ImportedNote[] {
    const lines = content.split('\n');
    if (lines.length < 2) return [];

    // Skip header row
    const dataLines = lines.slice(1).filter(line => line.trim().length > 0);
    const notes: ImportedNote[] = [];

    for (const line of dataLines) {
        try {
            // CSV parsing - handle quoted fields with commas
            const fields = parseCSVLine(line);
            if (fields.length < 5) continue;

            const [title, chapter, position, readerUrl, quote] = fields;

            if (!quote || !quote.trim()) continue;

            notes.push({
                bookTitle: cleanBookTitle(title),
                chapter: chapter || undefined,
                position: position ? parseFloat(position) : undefined,
                readerUrl: readerUrl || undefined,
                quote: quote.trim(),
            });
        } catch (e) {
            console.warn('Failed to parse CSV line:', line, e);
        }
    }

    return notes;
}

/**
 * Parse a single CSV line handling quoted fields
 */
function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                // Escaped quote
                current += '"';
                i++;
            } else {
                // Toggle quote mode
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }

    result.push(current.trim());
    return result;
}

// ===================================
// Markdown Parser (BookFusion format)
// ===================================

/**
 * Parse Google Play Books Drive/Docs Markdown export
 * Format:
 * | ![Cover Image][image1] | *Title* Author | (Header)
 * ## *Chapter*
 * | ![][image2] *Quote* Date [Page](Url) |
 */
export function parseGoogleBooksMarkdown(content: string): ImportedNote[] {
    const lines = content.split('\n');
    const notes: ImportedNote[] = [];

    let bookTitle = 'Libro importado';
    let currentChapter: string | undefined;

    // 1. Try to find title in the first few lines (usually line 0 or 2 depending on empty lines)
    // Header format: | ![Cover Image][image1] | *Visigodos (Historia) (Spanish Edition)* José Javier Esparza ... |
    const headerLine = lines.find(line => line.includes('![Cover Image]'));
    if (headerLine) {
        // Extract content between * *
        const titleMatch = headerLine.match(/\*([^*]+)\*/);
        if (titleMatch) {
            bookTitle = cleanBookTitle(titleMatch[1]);
        }
    }

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Chapter header: ## *INTRODUCCIÓN*
        if (trimmed.startsWith('##')) {
            const cleanChapter = trimmed.replace(/^##\s*/, '').replace(/\*/g, '').trim();
            if (cleanChapter) {
                currentChapter = cleanChapter;
            }
            continue;
        }

        // Note line: | ![][image2] *Quote* 15 de noviembre de 2021 [4](http...) |
        // Relax check: allow lines starting with | or just containing ![][image
        if (trimmed.includes('![][image')) {
            try {
                const note = parseGoogleBooksNoteLine(trimmed, bookTitle, currentChapter);
                if (note) {
                    notes.push(note);
                }
            } catch (e) {
                console.warn('Failed to parse Google Books note line:', trimmed, e);
            }
        }
    }

    return notes;
}

function parseGoogleBooksNoteLine(line: string, bookTitle: string, chapter?: string): ImportedNote | null {
    // Regex to capture:
    // 1. Image ID (color)
    // 3. Date (text between quote and page link)
    // 4. Page number
    // 5. URL
    // Pattern: | ![][imageX] *Quote* Date [Page](Url) |

    // Strategy: Outside-In
    // 1. Extract Link from the end.
    // 2. Extract Image from the start.
    // 3. The middle is [Quote + Date]
    // 4. Try to strip Date from the end of the middle.

    // 1. Link (End)
    // Finding [Page](Url) at the end, ignoring trailing pipes/spaces.
    const linkMatch = line.match(/\[([^\]]*)\]\((http[^\)]+)\)\s*\|?\s*$/);
    const pageStr = linkMatch ? linkMatch[1] : undefined;
    const readerUrl = linkMatch ? linkMatch[2] : undefined;

    const linkIndex = (linkMatch && linkMatch.index !== undefined) ? linkMatch.index : -1;

    // 2. Image (Start)
    // Finding ![][imageX] at the start, ignoring leading pipes/spaces.
    const imageMatch = line.match(/^\s*\|?\s*!\[\]\[(image\d+)\]/);
    const imageId = imageMatch ? imageMatch[1] : undefined;

    const imageEndIndex = imageMatch ? (imageMatch.index || 0) + imageMatch[0].length : 0;

    // 3. Middle Content
    // Slice between matches
    let content = '';
    if (linkIndex > -1) {
        content = line.substring(imageEndIndex, linkIndex).trim();
    } else {
        // Fallback: if no link found, take everything after image
        content = line.substring(imageEndIndex).replace(/\|\s*$/, '').trim();
    }

    // 4. Date Extraction
    // Expect date at the end of content. Format: "15 de noviembre de 2021"
    let date: Date | undefined;

    // Regex looking for date at the end of the string
    const dateMatch = content.match(/(\d{1,2}\s+de\s+[a-zA-Z]+\s+de\s+\d{4})$/);

    let quote = content;
    if (dateMatch) {
        date = parseSpanishDate(dateMatch[1]);
        if (dateMatch.index !== undefined) {
            quote = content.substring(0, dateMatch.index).trim();
        }
    }

    // 5. Cleanup Quote
    // Remove wrapping * if present
    if (quote.startsWith('*') && quote.endsWith('*')) {
        quote = quote.substring(1, quote.length - 1).trim();
    }

    if (!quote) return null;

    // Map color
    let color: string | undefined;
    if (imageId) {
        switch (imageId) {
            case 'image2': color = '#ff5722'; break; // Orange (approx)
            case 'image3': color = '#ffd700'; break; // Yellow
            case 'image4': color = '#2196f3'; break; // Blue
            default: color = '#ffd700'; // Default yellow
        }
    }

    return {
        bookTitle,
        chapter,
        position: pageStr ? parseFloat(pageStr) : undefined,
        readerUrl,
        quote,
        color,
        date,
    };
}

function parseSpanishDate(dateStr: string): Date | undefined {
    // Format: "15 de noviembre de 2021"
    const months: Record<string, string> = {
        'enero': '01', 'febrero': '02', 'marzo': '03', 'abril': '04',
        'mayo': '05', 'junio': '06', 'julio': '07', 'agosto': '08',
        'septiembre': '09', 'octubre': '10', 'noviembre': '11', 'diciembre': '12'
    };

    try {
        const parts = dateStr.toLowerCase().split(' de ');
        if (parts.length === 3) {
            const day = parts[0].padStart(2, '0');
            const month = months[parts[1]] || '01';
            const year = parts[2];
            return new Date(`${year}-${month}-${day}T12:00:00Z`);
        }
    } catch (e) {
        return undefined;
    }
    return undefined;
}



/**
 * Parse BookFusion Markdown export
 * Format:
 * ## [CHAPTER](URL)
 * 
 * 0.97%, 2026-01-07 15:41:07 UTC
 * 
 * Color: #fbde5d
 * 
 * > Quote text...
 */
export function parseBookFusionMarkdown(content: string): ImportedNote[] {
    const notes: ImportedNote[] = [];

    // Split by ## headers
    const sections = content.split(/^## /m).filter(s => s.trim());

    // Try to extract book title from filename or first line
    let bookTitle = 'Libro importado';
    const titleMatch = content.match(/^# (.+)$/m);
    if (titleMatch) {
        bookTitle = titleMatch[1].trim();
    }

    for (const section of sections) {
        try {
            const note = parseMarkdownSection(section, bookTitle);
            if (note) {
                notes.push(note);
            }
        } catch (e) {
            console.warn('Failed to parse MD section:', section.slice(0, 100), e);
        }
    }

    return notes;
}

function parseMarkdownSection(section: string, defaultTitle: string): ImportedNote | null {
    const lines = section.split('\n');
    if (lines.length < 1) return null;

    // First line: [CHAPTER](URL)
    const headerMatch = lines[0].match(/\[(.+?)\]\((.+?)\)/);
    const chapter = headerMatch ? headerMatch[1] : undefined;
    const readerUrl = headerMatch ? headerMatch[2] : undefined;

    // Extract book title from URL if possible
    let bookTitle = defaultTitle;
    if (readerUrl) {
        const urlTitleMatch = readerUrl.match(/books\/\d+-(.+?)\?/);
        if (urlTitleMatch) {
            bookTitle = urlTitleMatch[1]
                .replace(/-/g, ' ')
                .replace(/spanish edition/i, '')
                .trim();
            // Capitalize first letter of each word
            bookTitle = bookTitle.replace(/\b\w/g, c => c.toUpperCase());
        }
    }

    // Find position/date line
    let position: number | undefined;
    let date: Date | undefined;
    const positionMatch = section.match(/(\d+\.?\d*)%,\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/);
    if (positionMatch) {
        position = parseFloat(positionMatch[1]);
        date = new Date(positionMatch[2] + ' UTC');
    }

    // Find color
    let color: string | undefined;
    const colorMatch = section.match(/Color:\s*(#[0-9a-fA-F]{6})/);
    if (colorMatch) {
        color = colorMatch[1];
    }

    // Extract quote (lines starting with >)
    const quoteLines: string[] = [];
    for (const line of lines) {
        if (line.startsWith('>')) {
            quoteLines.push(line.slice(1).trim());
        }
    }

    const quote = quoteLines.join(' ').trim();
    if (!quote) return null;

    return {
        bookTitle,
        chapter,
        position,
        readerUrl,
        quote,
        color,
        date,
    };
}

// ===================================
// Utilities
// ===================================

/**
 * Clean book title (remove edition suffix, etc.)
 */
function cleanBookTitle(title: string): string {
    return title
        .replace(/\s*\([^)]*edition[^)]*\)/gi, '')
        .replace(/\s*\([^)]*edición[^)]*\)/gi, '')
        .trim();
}

/**
 * Convert hex color to HighlightColor
 */
function hexToHighlightColor(hex?: string): HighlightColor {
    if (!hex) return 'yellow';

    // BookFusion colors mapping
    const colorMap: Record<string, HighlightColor> = {
        '#fbde5d': 'yellow',
        '#ffeb3b': 'yellow',
        '#ffd700': 'yellow',
        '#a5d6a7': 'green',
        '#81c784': 'green',
        '#4caf50': 'green',
        '#90caf9': 'blue',
        '#64b5f6': 'blue',
        '#2196f3': 'blue',
        '#f48fb1': 'pink',
        '#f06292': 'pink',
        '#e91e63': 'pink',
        '#ffab91': 'orange',
        '#ff8a65': 'orange',
        '#ff5722': 'orange',
    };

    const normalized = hex.toLowerCase();
    return colorMap[normalized] || 'yellow';
}

/**
 * Find book by title (fuzzy match)
 */
async function findBookByTitle(title: string, books: Book[]): Promise<Book | undefined> {
    const normalizedTitle = title.toLowerCase().trim();

    // Exact match first
    let found = books.find(b => b.title.toLowerCase().trim() === normalizedTitle);
    if (found) return found;

    // Partial match
    found = books.find(b =>
        b.title.toLowerCase().includes(normalizedTitle) ||
        normalizedTitle.includes(b.title.toLowerCase())
    );
    if (found) return found;

    // Word-based match
    const words = normalizedTitle.split(/\s+/).filter(w => w.length > 3);
    found = books.find(b => {
        const bookWords = b.title.toLowerCase().split(/\s+/);
        return words.some(w => bookWords.some(bw => bw.includes(w)));
    });

    return found;
}

// ===================================
// Import Function
// ===================================

/**
 * Import notes and convert to Annotations
 */
export async function importNotes(
    importedNotes: ImportedNote[],
    userId: string,
    targetBookId?: string,
): Promise<ImportResult> {
    const result: ImportResult = {
        success: false,
        imported: 0,
        skipped: 0,
        errors: [],
        annotations: [],
    };

    if (importedNotes.length === 0) {
        result.errors.push('No se encontraron notas para importar');
        return result;
    }

    const books = await getAllBooks();
    const annotations: Annotation[] = [];

    for (const note of importedNotes) {
        try {
            // Determine book ID
            let bookId = targetBookId;

            if (!bookId) {
                const book = await findBookByTitle(note.bookTitle, books);
                if (book) {
                    bookId = book.id;
                } else {
                    result.skipped++;
                    result.errors.push(`Libro no encontrado: "${note.bookTitle}"`);
                    continue;
                }
            }

            const annotation: Annotation = {
                id: uuidv4(),
                userId,
                bookId,
                cfi: note.readerUrl || '', // Use URL as reference, won't navigate
                text: note.quote,
                note: note.note,
                color: hexToHighlightColor(note.color),
                chapterTitle: note.chapter,
                chapterIndex: undefined,
                pageNumber: note.position ? Math.floor(note.position) : undefined,
                tags: ['importado'],
                isFavorite: false,
                isFlashcard: false,
                createdAt: note.date || new Date(),
                updatedAt: new Date(),
            };

            annotations.push(annotation);
            result.imported++;
        } catch (e) {
            result.skipped++;
            result.errors.push(`Error procesando nota: ${(e as Error).message}`);
        }
    }

    // Bulk insert annotations
    if (annotations.length > 0) {
        try {
            await db.annotations.bulkAdd(annotations);
            result.annotations = annotations;
            result.success = true;
        } catch (e) {
            result.success = false;
            result.errors.push(`Error guardando notas: ${(e as Error).message}`);
        }
    }

    return result;
}

/**
 * Detect file format and parse accordingly
 */
export function parseNotesFile(content: string, filename: string): ImportedNote[] {
    const extension = filename.toLowerCase().split('.').pop();

    // 1. Check for Google Books signatures (play.google.com or image table structure)
    // This looks for "![Cover Image]" or "![][image" or the google books URL
    if (content.includes('play.google.com/books') ||
        content.includes('![Cover Image]') ||
        content.includes('![][image')) {
        return parseGoogleBooksMarkdown(content);
    }

    // 2. Check for BookFusion CSV
    if (extension === 'csv' || content.includes('Title,Chapter,Position') || content.startsWith('"Title","Chapter"')) {
        return parseBookFusionCSV(content);
    }

    // 3. Fallback to BookFusion Markdown (or generic MD)
    if (extension === 'md' || extension === 'markdown' || (content.includes('##') && content.includes('>'))) {
        return parseBookFusionMarkdown(content);
    }

    return [];
}
