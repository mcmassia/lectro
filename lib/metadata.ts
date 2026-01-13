import { BookMetadata } from './db';

// Using Google Books API
const GOOGLE_BOOKS_API_URL = 'https://www.googleapis.com/books/v1/volumes';

export interface MetadataResult {
    title?: string;
    author?: string;
    description?: string;
    publisher?: string;
    publishedDate?: string;
    language?: string;
    cover?: string;
    tags?: string[];
}

export async function searchGoogleBooks(query: string): Promise<MetadataResult[]> {
    try {
        const response = await fetch(`${GOOGLE_BOOKS_API_URL}?q=${encodeURIComponent(query)}&maxResults=5`);
        const data = await response.json();

        if (!data.items) return [];

        return data.items.map((item: any) => {
            const info = item.volumeInfo;
            // Get the best image available (thumbnail or larger)
            const imageLinks = info.imageLinks || {};
            const cover = imageLinks.extraLarge || imageLinks.large || imageLinks.medium || imageLinks.small || imageLinks.thumbnail || imageLinks.smallThumbnail;

            // Normalize HTTPS for cover
            const secureCover = cover ? cover.replace('http:', 'https:') : undefined;

            return {
                title: info.title,
                author: info.authors ? info.authors[0] : undefined, // Primary author
                description: info.description,
                publisher: info.publisher,
                publishedDate: info.publishedDate,
                language: info.language,
                cover: secureCover,
                tags: info.categories // Categories often serve as tags
            };
        });
    } catch (error) {
        console.error('Error fetching from Google Books:', error);
        return [];
    }
}

/**
 * Searches specifically for a cover image given a query (title + author)
 */
export async function findCover(query: string): Promise<string | undefined> {
    const results = await searchGoogleBooks(query);
    const withCover = results.find(r => r.cover);
    return withCover?.cover;
}
