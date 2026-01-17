'use client';

import { useState, useEffect } from 'react';
import {
    getAllAnnotations,
    getAllBooks,
    getAllTags,
    updateAnnotation,
    deleteAnnotation,
    Annotation,
    Book,
    Tag
} from '@/lib/db';
import { useLibraryStore } from '@/stores/appStore';
import { NoteCard } from '@/components/notes/NoteCard';
import { NotesSidebar } from '@/components/notes/NotesSidebar';
import { InsightsPanel } from '@/components/notes/InsightsPanel';
import { useRouter } from 'next/navigation';
import { Download, Filter, ArrowUpDown } from 'lucide-react';
import { exportNotes } from '@/lib/notes/export';

export default function NotesPage() {
    const router = useRouter();
    const [notes, setNotes] = useState<Annotation[]>([]);
    const [books, setBooks] = useState<Book[]>([]);
    const [tags, setTags] = useState<Tag[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Global Search integration
    const { searchQuery } = useLibraryStore();

    // Filters
    const [selectedBookId, setSelectedBookId] = useState<string | undefined>(undefined);
    const [selectedTag, setSelectedTag] = useState<string | undefined>(undefined);
    const [isExportOpen, setIsExportOpen] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [fetchedNotes, fetchedBooks, fetchedTags] = await Promise.all([
                getAllAnnotations(),
                getAllBooks(),
                getAllTags()
            ]);
            setNotes(fetchedNotes);
            setBooks(fetchedBooks);
            setTags(fetchedTags);
        } catch (error) {
            console.error('Failed to load notes data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpdateNote = async (id: string, updates: Partial<Annotation>) => {
        try {
            await updateAnnotation(id, updates);
            setNotes(prev => prev.map(n => n.id === id ? { ...n, ...updates } : n));
        } catch (error) {
            console.error('Failed to update note:', error);
        }
    };

    const handleDeleteNote = async (id: string) => {
        if (!confirm('¿Estás seguro de que quieres eliminar esta nota?')) return;
        try {
            await deleteAnnotation(id);
            setNotes(prev => prev.filter(n => n.id !== id));
        } catch (error) {
            console.error('Failed to delete note:', error);
        }
    };

    const handleNavigate = (bookId: string, cfi: string) => {
        router.push(`/reader/${bookId}?cfi=${encodeURIComponent(cfi)}`);
    };

    // Filter Logic
    const filteredNotes = notes.filter(note => {
        // Book Filter
        if (selectedBookId && note.bookId !== selectedBookId) return false;

        // Tag Filter
        if (selectedTag && (!note.tags || !note.tags.includes(selectedTag))) return false;

        // Search Query Filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const book = books.find(b => b.id === note.bookId);
            const matchesText = note.text.toLowerCase().includes(query);
            const matchesNote = note.note?.toLowerCase().includes(query);
            const matchesBookIndex = book?.title.toLowerCase().includes(query);
            const matchesTags = note.tags?.some(tag => tag.toLowerCase().includes(query));

            if (!matchesText && !matchesNote && !matchesBookIndex && !matchesTags) {
                return false;
            }
        }

        return true;
    });

    const handleExport = (format: 'json' | 'csv' | 'markdown' | 'pdf') => {
        const bookTitle = selectedBookId ? books.find(b => b.id === selectedBookId)?.title : undefined;
        exportNotes(filteredNotes, format, bookTitle);
    };

    // Stats
    const notesCount = filteredNotes.length;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full w-full bg-[var(--color-bg-primary)]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-accent)]"></div>
            </div>
        );
    }

    return (
        <div className="flex h-full w-full bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
            {/* Left Column: Navigation & Filters */}
            <div className="flex-shrink-0">
                <NotesSidebar
                    books={books}
                    tags={tags}
                    selectedBookId={selectedBookId}
                    selectedTag={selectedTag}
                    onSelectBook={setSelectedBookId}
                    onSelectTag={setSelectedTag}
                />
            </div>

            {/* Center Column: Feed */}
            <main className="flex-1 min-w-0 overflow-y-auto bg-[var(--color-bg-primary)] custom-scrollbar py-10 px-10">
                <div className="space-y-10">

                    {/* Header */}
                    <div className="flex items-end justify-between border-b border-[var(--color-border)] pb-8 mb-2">
                        <div>
                            <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-1">Flujo de Pensamiento</h1>
                            <p className="text-[var(--color-text-secondary)]">Tus últimas reflexiones y lecturas</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] text-xs font-medium hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] transition-colors">
                                <Filter size={14} />
                                Filtrar
                            </button>
                            <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] text-xs font-medium hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] transition-colors">
                                <ArrowUpDown size={14} />
                                Ordenar
                            </button>

                            <div className="relative">
                                <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] text-xs font-medium hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] transition-colors" onClick={() => setIsExportOpen(!isExportOpen)}>
                                    <Download size={14} />
                                    Exportar
                                </button>
                                {isExportOpen && (
                                    <>
                                        <div className="fixed inset-0 z-10" onClick={() => setIsExportOpen(false)} />
                                        <div className="absolute top-full right-0 mt-2 w-40 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg shadow-xl z-20 overflow-hidden py-1">
                                            <button onClick={() => { handleExport('json'); setIsExportOpen(false); }} className="w-full text-left px-4 py-2 hover:bg-[var(--color-bg-secondary)] text-xs text-[var(--color-text-primary)]">JSON</button>
                                            <button onClick={() => { handleExport('csv'); setIsExportOpen(false); }} className="w-full text-left px-4 py-2 hover:bg-[var(--color-bg-secondary)] text-xs text-[var(--color-text-primary)]">CSV</button>
                                            <button onClick={() => { handleExport('markdown'); setIsExportOpen(false); }} className="w-full text-left px-4 py-2 hover:bg-[var(--color-bg-secondary)] text-xs text-[var(--color-text-primary)]">Markdown</button>
                                            <button onClick={() => { handleExport('pdf'); setIsExportOpen(false); }} className="w-full text-left px-4 py-2 hover:bg-[var(--color-bg-secondary)] text-xs text-[var(--color-text-primary)]">PDF</button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Feed */}
                    <div className="space-y-14">
                        {filteredNotes.length > 0 ? (
                            filteredNotes.map(note => {
                                const book = books.find(b => b.id === note.bookId);
                                return (
                                    <NoteCard
                                        key={note.id}
                                        note={note}
                                        bookTitle={book?.title || 'Libro desconocido'}
                                        bookCover={book?.cover}
                                        bookAuthor={book?.author}
                                        chapterInfo={note.chapterTitle || (note.pageNumber ? `Pág. ${note.pageNumber}` : undefined)}
                                        onUpdate={handleUpdateNote}
                                        onDelete={handleDeleteNote}
                                        onNavigate={handleNavigate}
                                    />
                                );
                            })
                        ) : (
                            <div className="text-center py-20 bg-[var(--color-bg-secondary)]/30 rounded-xl border border-dashed border-[var(--color-border)]">
                                <p className="text-[var(--color-text-secondary)] mb-2">No se encontraron notas</p>
                                <p className="text-xs text-[var(--color-text-tertiary)]">Prueba a cambiar la búsqueda o lee un libro para añadir notas.</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Right Column */}
            <InsightsPanel notes={notes} />
        </div>
    );
}
