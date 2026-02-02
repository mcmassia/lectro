'use client';

import { Book, Annotation } from '@/lib/db';
import { Calendar } from 'lucide-react';

interface BookWithNotes {
    book: Book;
    notesCount: number;
    lastNoteDate: Date;
}

interface NotesSidebarProps {
    booksWithNotes: BookWithNotes[];
    selectedBookId?: string;
    onSelectBook: (id?: string) => void;
}

export function NotesSidebar({
    booksWithNotes,
    selectedBookId,
    onSelectBook
}: NotesSidebarProps) {

    return (
        <aside className="w-[280px] flex flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] h-full">

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-10 custom-scrollbar">

                {/* Books Section */}
                <div>
                    <div className="flex items-center justify-between px-2 mb-3">
                        <h2 className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-tertiary)]">Libros con notas</h2>
                        <span className="text-[10px] text-[var(--color-text-tertiary)]">{booksWithNotes.length} libros</span>
                    </div>

                    <div className="space-y-3">
                        {booksWithNotes.length > 0 ? (
                            booksWithNotes.map(({ book, notesCount, lastNoteDate }) => {
                                const isSelected = selectedBookId === book.id;

                                return (
                                    <button
                                        key={book.id}
                                        onClick={() => onSelectBook(isSelected ? undefined : book.id)}
                                        className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all group ${isSelected ? 'bg-[var(--color-bg-elevated)] shadow-sm' : 'hover:bg-[var(--color-bg-tertiary)]'}`}
                                    >
                                        {/* Book Cover */}
                                        <div className="w-12 h-16 bg-[var(--color-bg-tertiary)] rounded-md overflow-hidden flex-shrink-0 relative shadow-md border border-[var(--color-border)] group-hover:shadow-lg transition-all">
                                            <img
                                                src={`/api/covers/${book.id}?width=100`}
                                                alt={book.title}
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                    const target = e.target as HTMLImageElement;
                                                    if (book.cover && target.src !== book.cover) {
                                                        target.src = book.cover;
                                                    } else {
                                                        target.style.display = 'none';
                                                    }
                                                }}
                                            />
                                        </div>

                                        <div className="flex-1 text-left min-w-0">
                                            <div className={`text-sm font-medium truncate ${isSelected ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-primary)]'}`}>
                                                {book.title}
                                            </div>
                                            <div className="text-xs text-[var(--color-text-tertiary)] truncate mb-1">
                                                {book.author || 'Autor desconocido'}
                                            </div>
                                            <div className="text-[10px] text-[var(--color-text-tertiary)]">
                                                {notesCount} nota{notesCount !== 1 ? 's' : ''} • {lastNoteDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                                            </div>
                                        </div>

                                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]"></div>}
                                    </button>
                                );
                            })
                        ) : (
                            <div className="text-center py-8 text-[var(--color-text-tertiary)] text-sm">
                                No hay libros con notas
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </aside>
    );
}
