'use client';

import { Annotation } from '@/lib/db';
import { BookOpen, Edit2, Image as ImageIcon, HelpCircle, Share2, MoreVertical } from 'lucide-react';

interface NoteCardProps {
    note: Annotation;
    bookTitle: string;
    bookId: string;
    bookCover?: string;
    bookAuthor?: string;
    chapterInfo?: string;
    onUpdate: (id: string, updates: Partial<Annotation>) => void;
    onDelete: (id: string) => void;
    onNavigate: (bookId: string, cfi: string) => void;
}

export function NoteCard({
    note,
    bookTitle,
    bookId,
    bookCover,
    bookAuthor = "Autor desconocido",
    chapterInfo,
    onUpdate,
    onDelete,
    onNavigate
}: NoteCardProps) {
    const isQuote = note.text && note.text.length > 0;

    // Determine quote background and border color based on note.color
    const color = note.color as string;
    const quoteStyles = {
        yellow: { bg: 'bg-yellow-900/30', border: 'border-l-yellow-500' },
        red: { bg: 'bg-red-900/30', border: 'border-l-red-500' },
        blue: { bg: 'bg-blue-900/30', border: 'border-l-blue-500' },
        green: { bg: 'bg-green-900/30', border: 'border-l-green-500' },
        pink: { bg: 'bg-pink-900/30', border: 'border-l-pink-500' },
        orange: { bg: 'bg-orange-900/30', border: 'border-l-orange-500' },
    };
    const currentStyle = quoteStyles[color as keyof typeof quoteStyles] || quoteStyles.red;

    // Chapter/page info display
    const locationInfo = chapterInfo || (note.chapterTitle ? `Cap. ${note.chapterIndex || ''}` : (note.pageNumber ? `Pág. ${note.pageNumber}` : ''));

    return (
        <div className="border-b border-[var(--color-border)] pt-4">

            {/* Header: Book info */}
            <div className="flex items-center gap-4 p-5 pb-4">
                {/* Book Cover - Small square */}
                <div className="w-11 h-14 bg-[var(--color-bg-tertiary)] rounded-lg overflow-hidden flex-shrink-0 border border-[var(--color-border)] shadow-sm">
                    <img
                        src={`/api/covers/${bookId}?width=100`}
                        alt={bookTitle}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            if (bookCover && target.src !== bookCover) {
                                target.src = bookCover;
                            } else {
                                target.style.display = 'none';
                            }
                        }}
                    />
                </div>

                {/* Book Meta */}
                <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-[var(--color-text-primary)] leading-tight mb-0.5">{bookTitle}</h3>
                    <p className="text-xs text-[var(--color-text-tertiary)] uppercase tracking-wide">
                        {bookAuthor}{locationInfo && ` • ${locationInfo}`}
                    </p>
                    <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                        {new Date(note.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })} • {new Date(note.createdAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                </div>

                {/* More Menu */}
                <button className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] p-1.5 rounded-lg hover:bg-[var(--color-bg-tertiary)] transition-colors">
                    <MoreVertical size={18} />
                </button>
            </div>

            {/* Quote Block */}
            {isQuote && (
                <div
                    className="mx-5 mb-4 p-5 rounded-xl border-l-4 border-l-yellow-500"
                    style={{ backgroundColor: 'color-mix(in oklab, oklch(0.97 0.01 0) 30%, transparent)' }}
                >
                    <p className="text-base leading-relaxed text-[var(--color-text-primary)] font-serif italic">
                        "{note.text}"
                    </p>
                </div>
            )}

            {/* User Note Section */}
            {note.note && (
                <div className="px-5 pb-4">
                    <span className="block text-xs font-bold text-[var(--color-accent)] uppercase tracking-wider mb-2">Mi Nota</span>
                    <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                        {note.note}
                    </p>
                </div>
            )}

            {/* Action Footer */}
            <div className="flex items-center justify-between px-5 py-3 mt-4">
                {/* Left Actions */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => onNavigate(note.bookId, note.cfi)}
                        className="flex items-center gap-2 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                    >
                        <BookOpen size={14} />
                        <span>Ir al libro</span>
                    </button>
                    <button
                        className="flex items-center gap-2 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                    >
                        <Edit2 size={14} />
                        <span>Editar</span>
                    </button>
                </div>

                {/* Right Icons */}
                <div className="flex items-center gap-2">
                    <button
                        className="p-2 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] rounded-lg transition-colors"
                        title="Añadir imagen"
                    >
                        <ImageIcon size={16} />
                    </button>
                    <button
                        className="p-2 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] rounded-lg transition-colors"
                        title="Preguntar a la IA"
                    >
                        <HelpCircle size={16} />
                    </button>
                    <button
                        className="p-2 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] rounded-lg transition-colors"
                        title="Compartir"
                    >
                        <Share2 size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
}
