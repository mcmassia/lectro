'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAppStore, useLibraryStore } from '@/stores/appStore';
import { db, Book, XRayData } from '@/lib/db';
import { XRayView } from '@/components/library/XRayView';
import { ArrowLeft } from 'lucide-react';

export default function BookXRayPage() {
    const params = useParams();
    const router = useRouter();
    const { currentUser } = useAppStore();
    const { books } = useLibraryStore();
    const [book, setBook] = useState<Book | null>(null);
    const [xrayData, setXrayData] = useState<XRayData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const bookId = params.id as string;

    useEffect(() => {
        if (!currentUser) {
            router.push('/login');
            return;
        }

        async function loadData() {
            setIsLoading(true);

            try {
                // Load book
                let loadedBook = books.find(b => b.id === bookId);
                if (!loadedBook) {
                    loadedBook = await db.books.get(bookId);
                }
                setBook(loadedBook || null);

                // Load X-Ray data
                const xray = await db.xrayData.where('bookId').equals(bookId).first();
                setXrayData(xray || null);
            } catch (error) {
                console.error('Error loading X-Ray data:', error);
            } finally {
                setIsLoading(false);
            }
        }

        loadData();
    }, [bookId, currentUser, books, router]);

    const handleBack = () => {
        // Go back to book details
        router.push(`/book/${bookId}`);
    };

    if (!currentUser) {
        return null;
    }

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-screen gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
                <p className="text-gray-500">Cargando análisis ADN...</p>
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

    if (!xrayData) {
        return (
            <div className="flex flex-col items-center justify-center h-screen gap-4">
                <p className="text-secondary">No se encontró análisis ADN para este libro</p>
                <button className="btn btn-primary" onClick={handleBack}>
                    Volver al libro
                </button>
            </div>
        );
    }

    return (
        <div className="h-full w-full">
            <XRayView
                data={xrayData}
                book={book}
                onBack={handleBack}
            />
        </div>
    );
}
