'use client';

import { Book, Tag } from '@/lib/db';
import { Search, Calendar, ChevronRight } from 'lucide-react';

interface NotesSidebarProps {
    books: Book[];
    tags: Tag[];
    selectedBookId?: string;
    selectedTag?: string;
    onSelectBook: (id?: string) => void;
    onSelectTag: (tag?: string) => void;
}

export function NotesSidebar({
    books,
    tags,
    selectedBookId,
    selectedTag,
    onSelectBook,
    onSelectTag
}: NotesSidebarProps) {
    // Mock recent counts/logic
    const recentBooks = books.slice(0, 5);

    return (
        <aside className="w-[280px] flex flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] h-full">

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-10 custom-scrollbar">

                {/* Books Section */}
                <div>
                    <div className="flex items-center justify-between px-2 mb-3">
                        <h2 className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-tertiary)]">Libros con notas recientes</h2>
                        <button className="text-[10px] text-[var(--color-accent)] hover:brightness-110 font-medium transition-colors">Ver todos</button>
                    </div>

                    <div className="space-y-6">
                        {recentBooks.map(book => {
                            const isSelected = selectedBookId === book.id;
                            const notesCount = Math.floor(Math.random() * 20) + 1; // Mock Data
                            const isNew = Math.random() > 0.5;

                            return (
                                <button
                                    key={book.id}
                                    onClick={() => onSelectBook(isSelected ? undefined : book.id)}
                                    className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all group ${isSelected ? 'bg-[var(--color-bg-elevated)] shadow-sm' : 'hover:bg-[var(--color-bg-tertiary)]'}`}
                                >
                                    {/* Book Cover Placeholder */}
                                    <div className="w-14 h-20 bg-[var(--color-bg-tertiary)] rounded-md overflow-hidden flex-shrink-0 relative shadow-md border border-[var(--color-border)] group-hover:shadow-lg transition-all">
                                        {book.cover ? (
                                            <img src={book.cover} className="w-full h-full object-cover" alt="" />
                                        ) : (
                                            <div className="absolute inset-0 flex items-center justify-center text-[10px] text-[var(--color-text-tertiary)] font-serif p-2 text-center leading-tight">
                                                {book.title.slice(0, 10)}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-1 text-left min-w-0">
                                        <div className={`text-sm font-medium truncate ${isSelected ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-primary)]'}`}>
                                            {book.title}
                                        </div>
                                        <div className="text-xs text-[var(--color-text-tertiary)] truncate">
                                            {notesCount} notas {isNew && <span className="text-[var(--color-text-secondary)] font-medium">• nuevas</span>}
                                        </div>
                                    </div>

                                    {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]"></div>}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Tags Section */}
                <div>
                    <h2 className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-tertiary)] px-2 mb-3">Mis Etiquetas</h2>
                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={() => onSelectTag(undefined)}
                            className={`text-[11px] px-3 py-1 rounded-full border transition-colors ${!selectedTag ? 'bg-[var(--color-bg-elevated)] border-[var(--color-border)] text-[var(--color-text-primary)]' : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'}`}
                        >
                            Todas
                        </button>
                        {tags.map(tag => (
                            <button
                                key={tag.id}
                                onClick={() => onSelectTag(selectedTag === tag.name ? undefined : tag.name)}
                                className={`text-[11px] px-3 py-1 rounded-full border transition-colors ${selectedTag === tag.name ? 'bg-[var(--color-accent-subtle)] border-[var(--color-accent)] text-[var(--color-accent)]' : 'border-[var(--color-border)] bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:border-[var(--color-text-tertiary)]'}`}
                            >
                                #{tag.name}
                            </button>
                        ))}
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
