'use client';

import { Annotation } from '@/lib/db';
import { Share2, Edit2, BookOpen, MoreHorizontal, MessageSquare, Trash2 } from 'lucide-react';
import Image from 'next/image';

interface NoteCardProps {
    note: Annotation;
    bookTitle: string;
    bookCover?: string;
    bookAuthor?: string;
    onUpdate: (id: string, updates: Partial<Annotation>) => void;
    onDelete: (id: string) => void;
    onNavigate: (bookId: string, cfi: string) => void;
}

export function NoteCard({ note, bookTitle, bookCover, bookAuthor = "Desconocido", onUpdate, onDelete, onNavigate }: NoteCardProps) {
    const isQuote = note.text && note.text.length > 0;

    // Format Date: Use createdAt as defined in DB schema
    const dateStr = new Date(note.createdAt).toLocaleDateString('es-ES', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    // Helper for color styles to avoid extensive type logic in JSX and fix lint error
    // Casting note.color as string to allow comparison against 'red' without TS complaints if type definition is strict
    const color = note.color as string;
    const barColor = color === 'yellow' ? 'bg-yellow-500' :
        color === 'red' ? 'bg-red-500' :
            color === 'blue' ? 'bg-blue-500' :
                color === 'green' ? 'bg-green-500' : 'bg-yellow-500';

    return (
        <div className="group relative bg-[var(--color-bg-elevated)] rounded-2xl p-8 border border-[var(--color-border)] hover:border-[var(--color-border-strong)] transition-all shadow-sm">

            {/* Header: Cover + Meta */}
            <div className="flex items-start gap-6 mb-7">
                {/* Cover Thumbnail */}
                <div className="w-12 h-16 bg-[var(--color-bg-tertiary)] rounded-sm overflow-hidden flex-shrink-0 border border-[var(--color-border)] shadow-sm">
                    {bookCover ? (
                        <img src={bookCover} alt={bookTitle} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)]">
                            <BookOpen size={20} />
                        </div>
                    )}
                </div>

                {/* Meta Info */}
                <div className="flex-1 min-w-0 pt-1">
                    <h3 className="text-base font-bold text-[var(--color-text-primary)] leading-tight mb-1">{bookTitle}</h3>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-xs text-[var(--color-text-tertiary)]">
                        <span className="font-medium text-[var(--color-text-secondary)]">{bookAuthor}</span>
                        <span className="hidden sm:inline opacity-50">•</span>
                        <span>{dateStr}</span>
                    </div>
                </div>

                {/* Context Menu */}
                <button className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] p-1.5 rounded-md hover:bg-[var(--color-bg-tertiary)] transition-colors">
                    <MoreHorizontal size={18} />
                </button>
            </div>

            {/* Content Body */}
            <div className="flex gap-8">
                {/* Quote Block */}
                <div className="flex-1 min-w-0">
                    {isQuote && (
                        <div className="flex gap-5 mb-5">
                            {/* Vertical Colored Bar */}
                            <div className={`w-[4px] rounded-full flex-shrink-0 ${barColor}`}></div>

                            <div className="text-base leading-relaxed text-[var(--color-text-secondary)] font-serif italic selection:bg-[var(--color-accent-subtle)]">
                                "{note.text}"
                            </div>
                        </div>
                    )}

                    {/* User Note */}
                    {note.note && (
                        <div className="mt-6 pl-6 border-l-2 border-[var(--color-border)]">
                            <span className="block text-[10px] font-bold text-[var(--color-accent)] uppercase tracking-wider mb-1.5">Mi Nota</span>
                            <p className="text-sm text-[var(--color-text-primary)] leading-relaxed">
                                {note.note}
                            </p>
                        </div>
                    )}
                </div>

                {/* Right Side Actions (Vertical Stack) */}
                <div className="flex flex-col gap-3 items-center justify-start pt-1">
                    <button
                        onClick={() => onNavigate(note.bookId, note.cfi)}
                        title="Ir al libro"
                        className="p-2 bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent-subtle)] rounded-lg transition-all group/btn shadow-sm"
                    >
                        <BookOpen size={16} className="group-hover/btn:scale-110 transition-transform" />
                    </button>
                    <button
                        title="Comentar / Editar"
                        onClick={() => { }}
                        className="p-2 bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)] rounded-lg transition-all group/btn shadow-sm"
                    >
                        <Edit2 size={16} className="group-hover/btn:scale-110 transition-transform" />
                    </button>
                    <button
                        title="Chat AI"
                        onClick={() => { }}
                        className="p-2 bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)] rounded-lg transition-all group/btn shadow-sm"
                    >
                        <MessageSquare size={16} className="group-hover/btn:scale-110 transition-transform" />
                    </button>
                    <button
                        onClick={() => onDelete(note.id)}
                        title="Eliminar"
                        className="p-2 bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all mt-4 group/btn shadow-sm"
                    >
                        <Trash2 size={16} className="group-hover/btn:scale-110 transition-transform" />
                    </button>
                </div>
            </div>

        </div>
    );
}
