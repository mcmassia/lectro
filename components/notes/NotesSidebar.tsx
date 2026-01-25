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

            {/* Daily Review Card (Fixed Bottom) */}
            <div className="p-5 mt-auto border-t border-[var(--color-border)]">
                <div className="rounded-xl p-4 bg-gradient-to-r from-[var(--color-accent)]/20 to-[var(--color-bg-elevated)] border border-[var(--color-accent)]/30 relative overflow-hidden group cursor-pointer hover:border-[var(--color-accent)]/50 transition-all">
                    <div className="relative z-10 flex items-start justify-between">
                        <div className="p-2 bg-[var(--color-accent)] rounded-lg text-white mb-3 shadow-md">
                            <Calendar size={18} />
                        </div>
                        <div className="w-2 h-2 rounded-full bg-red-500"></div>
                    </div>

                    <div className="relative z-10">
                        <h3 className="font-semibold text-[var(--color-text-primary)] mb-0.5">Repaso Diario</h3>
                        <p className="text-xs text-[var(--color-text-secondary)]">15 destacados para hoy</p>
                    </div>

                    {/* Decorative Icon Background */}
                    <Calendar className="absolute -bottom-4 -right-4 text-[var(--color-accent)]/10 rotate-[-15deg]" size={80} />
                </div>
            </div>
        </aside>
    );
}
