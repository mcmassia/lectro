// APIs
const GOOGLE_BOOKS_API_URL = 'https://www.googleapis.com/books/v1/volumes';
const OPEN_LIBRARY_SEARCH_URL = 'https://openlibrary.org/search.json';
const OPEN_LIBRARY_COVERS_URL = 'https://covers.openlibrary.org/b/id';

export interface MetadataResult {
    source: 'GoogleBooks' | 'OpenLibrary';
    id: string;
    title: string;
    author: string;
    description?: string;
    publisher?: string;
    publishedDate?: string;
    language?: string;
    cover?: string;
    tags?: string[];
    isbn?: string;
}

export async function searchGoogleBooks(query: string): Promise<MetadataResult[]> {
    try {
        const response = await fetch(`${GOOGLE_BOOKS_API_URL}?q=${encodeURIComponent(query)}&maxResults=10`);
        const data = await response.json();

        if (!data.items) return [];

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return data.items.map((item: any) => {
            const info = item.volumeInfo;
            // Get the best image available
            const imageLinks = info.imageLinks || {};
            let cover = imageLinks.extraLarge || imageLinks.large || imageLinks.medium || imageLinks.small || imageLinks.thumbnail || imageLinks.smallThumbnail;

            // Normalize HTTPS for cover
            if (cover) cover = cover.replace('http:', 'https:');

            return {
                source: 'GoogleBooks',
                id: item.id,
                title: info.title,
                author: info.authors ? info.authors[0] : 'Unknown',
                description: info.description,
                publisher: info.publisher,
                publishedDate: info.publishedDate,
                language: info.language,
                cover: cover,
                tags: info.categories,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                isbn: info.industryIdentifiers?.find((i: any) => i.type === 'ISBN_13')?.identifier
            };
        });
    } catch (error) {
        console.error('Error fetching from Google Books:', error);
        return [];
    }
}

export async function searchOpenLibrary(query: string): Promise<MetadataResult[]> {
    try {
        const response = await fetch(`${OPEN_LIBRARY_SEARCH_URL}?q=${encodeURIComponent(query)}&limit=10`);
        const data = await response.json();

        if (!data.docs) return [];

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return data.docs.map((doc: any) => {
            const coverId = doc.cover_i;
            const cover = coverId ? `${OPEN_LIBRARY_COVERS_URL}/${coverId}-L.jpg` : undefined;

            return {
                source: 'OpenLibrary',
                id: doc.key,
                title: doc.title,
                author: doc.author_name ? doc.author_name[0] : 'Unknown',
                publisher: doc.publisher ? doc.publisher[0] : undefined,
                publishedDate: doc.first_publish_year ? doc.first_publish_year.toString() : undefined,
                language: doc.language ? doc.language[0] : undefined,
                cover: cover,
                tags: doc.subject ? doc.subject.slice(0, 5) : undefined, // Limit tags
                isbn: doc.isbn ? doc.isbn[0] : undefined
            };
        });
    } catch (error) {
        console.error('Error fetching from Open Library:', error);
        return [];
    }
}

/**
 * Aggregates results from multiple sources
 */
export async function searchMetadata(query: string): Promise<MetadataResult[]> {
    const [googleResults, openLibResults] = await Promise.all([
        searchGoogleBooks(query),
        searchOpenLibrary(query)
    ]);

    // Simple concatenation for now, could implement deduplication based on ISBN later
    return [...googleResults, ...openLibResults];
}

/**
 * Searches specifically for cover images
 */
export async function findCovers(query: string): Promise<string[]> {
    const results = await searchMetadata(query);
    // Return unique non-empty cover URLs
    return Array.from(new Set(results.map(r => r.cover).filter((c): c is string => !!c)));
}
