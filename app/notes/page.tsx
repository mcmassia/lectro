'use client';

import { useState, useEffect, useMemo } from 'react';
import {
    getAllAnnotationsForUser,
    getAllBooks,
    getAllTags,
    updateAnnotation,
    deleteAnnotation,
    Annotation,
    Book,
    Tag
} from '@/lib/db';
import { useLibraryStore, useAppStore } from '@/stores/appStore';
import { NoteCard } from '@/components/notes/NoteCard';
import { NotesSidebar } from '@/components/notes/NotesSidebar';
import { NotesAIChat } from '@/components/notes/NotesAIChat';
import { useRouter } from 'next/navigation';
import { Download, Upload, Filter, ArrowUpDown, ChevronDown, Check, X } from 'lucide-react';
import { exportNotes } from '@/lib/notes/export';
import { ImportNotesModal } from '@/components/notes/ImportNotesModal';

type SortBy = 'date' | 'book';
type SortDirection = 'asc' | 'desc';

export default function NotesPage() {
    const router = useRouter();
    const { currentUser } = useAppStore();
    const [notes, setNotes] = useState<Annotation[]>([]);
    const [books, setBooks] = useState<Book[]>([]);
    const [tags, setTags] = useState<Tag[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Global Search integration
    const { searchQuery } = useLibraryStore();

    // Filters
    const [selectedBookId, setSelectedBookId] = useState<string | undefined>(undefined);
    const [filterBookId, setFilterBookId] = useState<string | undefined>(undefined);
    const [filterAuthor, setFilterAuthor] = useState<string | undefined>(undefined);
    const [isFilterOpen, setIsFilterOpen] = useState(false);

    // Sort
    const [sortBy, setSortBy] = useState<SortBy>('date');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
    const [isSortOpen, setIsSortOpen] = useState(false);

    const [isExportOpen, setIsExportOpen] = useState(false);
    const [isImportOpen, setIsImportOpen] = useState(false);

    // Compute books with notes, sorted by last note date
    const booksWithNotes = useMemo(() => {
        const bookNotesMap = new Map<string, { book: Book; notesCount: number; lastNoteDate: Date }>();

        notes.forEach(note => {
            const book = books.find(b => b.id === note.bookId);
            if (!book) return;

            const existing = bookNotesMap.get(book.id);
            const noteDate = new Date(note.createdAt);

            if (existing) {
                existing.notesCount++;
                if (noteDate > existing.lastNoteDate) {
                    existing.lastNoteDate = noteDate;
                }
            } else {
                bookNotesMap.set(book.id, {
                    book,
                    notesCount: 1,
                    lastNoteDate: noteDate
                });
            }
        });

        return Array.from(bookNotesMap.values())
            .sort((a, b) => b.lastNoteDate.getTime() - a.lastNoteDate.getTime());
    }, [notes, books]);

    // Compute unique authors with notes
    const authorsWithNotes = useMemo(() => {
        const authorSet = new Set<string>();
        booksWithNotes.forEach(({ book }) => {
            if (book.author) {
                authorSet.add(book.author);
            }
        });
        return Array.from(authorSet).sort();
    }, [booksWithNotes]);

    useEffect(() => {
        if (currentUser) {
            loadData();
        }
    }, [currentUser]);

    const loadData = async () => {
        if (!currentUser) return;
        try {
            const [fetchedNotes, fetchedBooks, fetchedTags] = await Promise.all([
                getAllAnnotationsForUser(currentUser.id),
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
    const filteredNotes = useMemo(() => {
        let result = notes.filter(note => {
            // Sidebar Book Filter
            if (selectedBookId && note.bookId !== selectedBookId) return false;

            // Header Book Filter
            if (filterBookId && note.bookId !== filterBookId) return false;

            // Author Filter
            if (filterAuthor) {
                const book = books.find(b => b.id === note.bookId);
                if (!book || book.author !== filterAuthor) return false;
            }

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

        // Sort
        result = [...result].sort((a, b) => {
            if (sortBy === 'date') {
                const dateA = new Date(a.createdAt).getTime();
                const dateB = new Date(b.createdAt).getTime();
                return sortDirection === 'desc' ? dateB - dateA : dateA - dateB;
            } else {
                // Sort by book title
                const bookA = books.find(bk => bk.id === a.bookId)?.title || '';
                const bookB = books.find(bk => bk.id === b.bookId)?.title || '';
                const comparison = bookA.localeCompare(bookB);
                return sortDirection === 'desc' ? -comparison : comparison;
            }
        });

        return result;
    }, [notes, selectedBookId, filterBookId, filterAuthor, searchQuery, sortBy, sortDirection, books]);

    const handleExport = (format: 'json' | 'csv' | 'markdown' | 'pdf') => {
        const bookTitle = selectedBookId ? books.find(b => b.id === selectedBookId)?.title : undefined;
        exportNotes(filteredNotes, format, bookTitle);
    };

    const clearFilters = () => {
        setFilterBookId(undefined);
        setFilterAuthor(undefined);
        setIsFilterOpen(false);
    };

    const hasActiveFilters = filterBookId || filterAuthor;

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
                    booksWithNotes={booksWithNotes}
                    selectedBookId={selectedBookId}
                    onSelectBook={setSelectedBookId}
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
                            {/* Filter Button */}
                            <div className="relative">
                                <button
                                    onClick={() => { setIsFilterOpen(!isFilterOpen); setIsSortOpen(false); }}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${hasActiveFilters ? 'border-[var(--color-accent)] text-[var(--color-accent)] bg-[var(--color-accent)]/10' : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]'}`}
                                >
                                    <Filter size={14} />
                                    Filtrar
                                    {hasActiveFilters && <span className="ml-1 w-2 h-2 rounded-full bg-[var(--color-accent)]"></span>}
                                    <ChevronDown size={12} />
                                </button>
                                {isFilterOpen && (
                                    <>
                                        <div className="fixed inset-0 z-10" onClick={() => setIsFilterOpen(false)} />
                                        <div className="absolute top-full right-0 mt-2 w-64 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-xl shadow-xl z-20 overflow-hidden">
                                            <div className="p-3 border-b border-[var(--color-border)] flex items-center justify-between">
                                                <span className="text-xs font-semibold text-[var(--color-text-primary)]">Filtros</span>
                                                {hasActiveFilters && (
                                                    <button onClick={clearFilters} className="text-[10px] text-[var(--color-accent)] hover:underline flex items-center gap-1">
                                                        <X size={10} /> Limpiar
                                                    </button>
                                                )}
                                            </div>

                                            {/* Filter by Book */}
                                            <div className="p-3 border-b border-[var(--color-border)]">
                                                <h4 className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-2">Por Libro</h4>
                                                <div className="max-h-32 overflow-y-auto space-y-1">
                                                    {booksWithNotes.map(({ book }) => (
                                                        <button
                                                            key={book.id}
                                                            onClick={() => { setFilterBookId(filterBookId === book.id ? undefined : book.id); }}
                                                            className={`w-full text-left px-2 py-1.5 rounded-lg text-xs transition-colors flex items-center justify-between ${filterBookId === book.id ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]' : 'hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]'}`}
                                                        >
                                                            <span className="truncate">{book.title}</span>
                                                            {filterBookId === book.id && <Check size={12} />}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Filter by Author */}
                                            <div className="p-3">
                                                <h4 className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-2">Por Autor</h4>
                                                <div className="max-h-32 overflow-y-auto space-y-1">
                                                    {authorsWithNotes.map(author => (
                                                        <button
                                                            key={author}
                                                            onClick={() => { setFilterAuthor(filterAuthor === author ? undefined : author); }}
                                                            className={`w-full text-left px-2 py-1.5 rounded-lg text-xs transition-colors flex items-center justify-between ${filterAuthor === author ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]' : 'hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]'}`}
                                                        >
                                                            <span className="truncate">{author}</span>
                                                            {filterAuthor === author && <Check size={12} />}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Sort Button */}
                            <div className="relative">
                                <button
                                    onClick={() => { setIsSortOpen(!isSortOpen); setIsFilterOpen(false); }}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] text-xs font-medium hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                                >
                                    <ArrowUpDown size={14} />
                                    Ordenar
                                    <ChevronDown size={12} />
                                </button>
                                {isSortOpen && (
                                    <>
                                        <div className="fixed inset-0 z-10" onClick={() => setIsSortOpen(false)} />
                                        <div className="absolute top-full right-0 mt-2 w-48 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-xl shadow-xl z-20 overflow-hidden">
                                            <div className="p-3 border-b border-[var(--color-border)]">
                                                <h4 className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-2">Ordenar por</h4>
                                                <button
                                                    onClick={() => setSortBy('date')}
                                                    className={`w-full text-left px-2 py-1.5 rounded-lg text-xs transition-colors flex items-center justify-between ${sortBy === 'date' ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]' : 'hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]'}`}
                                                >
                                                    Fecha
                                                    {sortBy === 'date' && <Check size={12} />}
                                                </button>
                                                <button
                                                    onClick={() => setSortBy('book')}
                                                    className={`w-full text-left px-2 py-1.5 rounded-lg text-xs transition-colors flex items-center justify-between ${sortBy === 'book' ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]' : 'hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]'}`}
                                                >
                                                    Libro
                                                    {sortBy === 'book' && <Check size={12} />}
                                                </button>
                                            </div>
                                            <div className="p-3">
                                                <h4 className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-2">Dirección</h4>
                                                <button
                                                    onClick={() => setSortDirection('desc')}
                                                    className={`w-full text-left px-2 py-1.5 rounded-lg text-xs transition-colors flex items-center justify-between ${sortDirection === 'desc' ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]' : 'hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]'}`}
                                                >
                                                    {sortBy === 'date' ? 'Más recientes primero' : 'Z → A'}
                                                    {sortDirection === 'desc' && <Check size={12} />}
                                                </button>
                                                <button
                                                    onClick={() => setSortDirection('asc')}
                                                    className={`w-full text-left px-2 py-1.5 rounded-lg text-xs transition-colors flex items-center justify-between ${sortDirection === 'asc' ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]' : 'hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]'}`}
                                                >
                                                    {sortBy === 'date' ? 'Más antiguas primero' : 'A → Z'}
                                                    {sortDirection === 'asc' && <Check size={12} />}
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            <button
                                onClick={() => setIsImportOpen(true)}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] text-xs font-medium hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                            >
                                <Upload size={14} />
                                Importar
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
                    <div>
                        {filteredNotes.length > 0 ? (
                            filteredNotes.map(note => {
                                const book = books.find(b => b.id === note.bookId);
                                return (
                                    <NoteCard
                                        key={note.id}
                                        note={note}
                                        bookId={book?.id || note.bookId}
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

            {/* Right Column: AI Chat */}
            <NotesAIChat notes={notes} books={books} />

            {/* Import Modal */}
            {isImportOpen && (
                <ImportNotesModal
                    books={books}
                    onClose={() => setIsImportOpen(false)}
                    onImportComplete={loadData}
                />
            )}
        </div>
    );
}
