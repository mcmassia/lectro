'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLibraryStore } from '@/stores/appStore';

function QueryParamsHandler() {
    const searchParams = useSearchParams();
    const { setSelectedBookId, setView } = useLibraryStore();

    useEffect(() => {
        const view = searchParams.get('view');
        const bookId = searchParams.get('bookId');

        if (view === 'book-details' && bookId) {
            setSelectedBookId(bookId);
            setView('book-details');
            // Clean up URL without triggering navigation
            window.history.replaceState({}, '', '/');
        }
    }, [searchParams, setSelectedBookId, setView]);

    return null;
}

export function QueryParamsHandlerWithSuspense() {
    return (
        <Suspense fallback={null}>
            <QueryParamsHandler />
        </Suspense>
    );
}
