
export interface GoogleBook {
    id: string;
    volumeInfo: {
        title: string;
        authors?: string[];
        publisher?: string;
        publishedDate?: string;
        description?: string;
        pageCount?: number;
        categories?: string[];
        averageRating?: number;
        ratingsCount?: number;
        imageLinks?: {
            thumbnail?: string;
            smallThumbnail?: string;
        };
        language?: string;
        previewLink?: string;
        infoLink?: string;
    };
}

export async function searchBooks(query: string, maxResults: number = 20): Promise<GoogleBook[]> {
    try {
        const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=${maxResults}&printType=books`);
        if (!res.ok) throw new Error('Failed to fetch from Google Books');
        const data = await res.json();
        return data.items || [];
    } catch (error) {
        console.error('Google Books Search Error:', error);
        return [];
    }
}

export async function searchBooksByAuthor(author: string, maxResults: number = 40): Promise<GoogleBook[]> {
    return searchBooks(`inauthor:${author}`, maxResults);
}

export async function getBookConfig(title: string, author: string): Promise<GoogleBook | null> {
    const results = await searchBooks(`intitle:${title} inauthor:${author}`, 1);
    return results[0] || null;
}
