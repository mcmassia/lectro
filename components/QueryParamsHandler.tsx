'use client';

import { useEffect, Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLibraryStore } from '@/stores/appStore';
import { db, Book } from '@/lib/db';

function QueryParamsHandler() {
    const searchParams = useSearchParams();
    const { setSelectedBookId, setView, books, addBook } = useLibraryStore();
    const [handled, setHandled] = useState(false);

    useEffect(() => {
        const view = searchParams.get('view');
        const bookId = searchParams.get('bookId');

        if (view === 'book-details' && bookId && !handled) {
            setHandled(true);

            // Check if book already exists in store
            const existingBook = books.find(b => b.id === bookId);

            if (existingBook) {
                // Book exists, just set the view
                setSelectedBookId(bookId);
                setView('book-details');
            } else {
                // Book not in store yet, load from DB
                db.books.get(bookId).then((book: Book | undefined) => {
                    if (book) {
                        // Add book to store if not already there
                        const currentBooks = useLibraryStore.getState().books;
                        if (!currentBooks.find(b => b.id === bookId)) {
                            addBook(book);
                        }
                        setSelectedBookId(bookId);
                        setView('book-details');
                    }
                });
            }

            // Clean up URL without triggering navigation
            window.history.replaceState({}, '', '/');
        }
    }, [searchParams, setSelectedBookId, setView, books, addBook, handled]);

    return null;
}

export function QueryParamsHandlerWithSuspense() {
    return (
        <Suspense fallback={null}>
            <QueryParamsHandler />
        </Suspense>
    );
}
