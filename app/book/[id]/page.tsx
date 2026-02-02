'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAppStore, useLibraryStore } from '@/stores/appStore';
import { db, Book } from '@/lib/db';
import { BookDetailsView } from '@/components/library/BookDetailsView';

export default function BookDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const { currentUser } = useAppStore();
    const { books, setSelectedBookId } = useLibraryStore();
    const [book, setBook] = useState<Book | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const bookId = params.id as string;

    useEffect(() => {
        if (!currentUser) {
            router.push('/login');
            return;
        }

        async function loadBook() {
            setIsLoading(true);

            // First check if book is in store
            const storeBook = books.find(b => b.id === bookId);
            if (storeBook) {
                setBook(storeBook);
                setSelectedBookId(bookId);
                setIsLoading(false);
                return;
            }

            // Otherwise load from DB
            try {
                const dbBook = await db.books.get(bookId);
                if (dbBook) {
                    setBook(dbBook);
                    setSelectedBookId(bookId);
                }
            } catch (error) {
                console.error('Error loading book:', error);
            } finally {
                setIsLoading(false);
            }
        }

        loadBook();
    }, [bookId, currentUser, books, router, setSelectedBookId]);

    const handleBack = () => {
        // Go back to previous page, or home if no history
        if (window.history.length > 1) {
            router.back();
        } else {
            router.push('/');
        }
    };

    if (!currentUser) {
        return null;
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent"></div>
            </div>
        );
    }

    if (!book) {
        return (
            <div className="flex flex-col items-center justify-center h-screen gap-4">
                <p className="text-secondary">Libro no encontrado</p>
                <button className="btn btn-primary" onClick={() => router.push('/')}>
                    Volver a la biblioteca
                </button>
            </div>
        );
    }

    return (
        <div className="h-full w-full">
            <BookDetailsView
                book={book}
                onBack={handleBack}
            />
        </div>
    );
}
