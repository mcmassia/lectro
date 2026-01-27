'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
import { X, Upload, FileText, Check, AlertCircle, Search } from 'lucide-react';
import { Book } from '@/lib/db';
import { parseNotesFile, importNotes, ImportedNote, ImportResult } from '@/lib/notes/import';
import { useAppStore } from '@/stores/appStore';

interface ImportNotesModalProps {
    books: Book[];
    onClose: () => void;
    onImportComplete: () => void;
}

type ImportStep = 'upload' | 'preview' | 'importing' | 'complete';

export function ImportNotesModal({ books, onClose, onImportComplete }: ImportNotesModalProps) {
    const { currentUser } = useAppStore();
    const [step, setStep] = useState<ImportStep>('upload');
    const [isDragging, setIsDragging] = useState(false);
    const [parsedNotes, setParsedNotes] = useState<ImportedNote[]>([]);
    const [selectedBookId, setSelectedBookId] = useState<string>('');
    const [importResult, setImportResult] = useState<ImportResult | null>(null);
    const [error, setError] = useState<string>('');
    const [bookSearchQuery, setBookSearchQuery] = useState<string>('');
    const [isBookSearchFocused, setIsBookSearchFocused] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            processFile(files[0]);
        }
    }, []);

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            processFile(files[0]);
        }
    }, []);

    const processFile = async (file: File) => {
        setError('');

        const validExtensions = ['csv', 'md', 'markdown', 'txt'];
        const ext = file.name.split('.').pop()?.toLowerCase();

        if (!ext || !validExtensions.includes(ext)) {
            setError('Formato no soportado. Usa archivos CSV o Markdown.');
            return;
        }

        try {
            const content = await file.text();
            const notes = parseNotesFile(content, file.name);

            if (notes.length === 0) {
                setError('No se encontraron notas en el archivo. Verifica el formato.');
                return;
            }

            setParsedNotes(notes);
            setStep('preview');
        } catch (e) {
            setError(`Error leyendo el archivo: ${(e as Error).message}`);
        }
    };

    const handleImport = async () => {
        if (!currentUser) return;

        setStep('importing');
        setError('');

        try {
            const result = await importNotes(parsedNotes, currentUser.id, selectedBookId || undefined);
            setImportResult(result);
            setStep('complete');

            if (result.success && result.imported > 0) {
                onImportComplete();
            }
        } catch (e) {
            setError(`Error importando: ${(e as Error).message}`);
            setStep('preview');
        }
    };

    // Group notes by book title for preview
    const notesByBook = parsedNotes.reduce((acc, note) => {
        const title = note.bookTitle || 'Sin título';
        if (!acc[title]) acc[title] = [];
        acc[title].push(note);
        return acc;
    }, {} as Record<string, ImportedNote[]>);

    const selectedBook = books.find(b => b.id === selectedBookId);

    // Filter books by search query
    const filteredBooks = useMemo(() => {
        if (!bookSearchQuery.trim()) return books.slice(0, 20); // Show first 20 if no search
        const query = bookSearchQuery.toLowerCase();
        return books.filter(book =>
            book.title.toLowerCase().includes(query) ||
            book.author?.toLowerCase().includes(query)
        ).slice(0, 20);
    }, [books, bookSearchQuery]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            {/* Modal */}
            <div className="relative w-full max-w-2xl max-h-[85vh] bg-[var(--color-bg-elevated)] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
                    <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                        Importar Notas
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* Upload Step */}
                    {step === 'upload' && (
                        <div className="space-y-6">
                            <p className="text-sm text-[var(--color-text-secondary)]">
                                Importa notas desde archivos CSV o Markdown exportados de BookFusion, Google Play Books u otras aplicaciones.
                            </p>

                            {/* Drop Zone */}
                            <div
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                                className={`
                  relative border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all
                  ${isDragging
                                        ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                                        : 'border-[var(--color-border)] hover:border-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-tertiary)]'
                                    }
                `}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".csv,.md,.markdown,.txt"
                                    onChange={handleFileSelect}
                                    className="hidden"
                                />

                                <div className="flex flex-col items-center gap-3">
                                    <div className={`p-4 rounded-full ${isDragging ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-bg-tertiary)]'}`}>
                                        <Upload size={24} className={isDragging ? 'text-white' : 'text-[var(--color-text-tertiary)]'} />
                                    </div>
                                    <div>
                                        <p className="font-medium text-[var(--color-text-primary)]">
                                            Arrastra tu archivo aquí
                                        </p>
                                        <p className="text-sm text-[var(--color-text-tertiary)] mt-1">
                                            o haz clic para seleccionar
                                        </p>
                                    </div>
                                    <p className="text-xs text-[var(--color-text-tertiary)]">
                                        Soporta: CSV, Markdown
                                    </p>
                                </div>
                            </div>

                            {error && (
                                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                                    <AlertCircle size={16} />
                                    {error}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Preview Step */}
                    {step === 'preview' && (
                        <div className="space-y-6">
                            {/* Summary */}
                            <div className="flex items-center gap-3 p-4 bg-[var(--color-bg-tertiary)] rounded-xl">
                                <FileText size={20} className="text-[var(--color-accent)]" />
                                <div>
                                    <p className="font-medium text-[var(--color-text-primary)]">
                                        {parsedNotes.length} notas encontradas
                                    </p>
                                    <p className="text-sm text-[var(--color-text-tertiary)]">
                                        de {Object.keys(notesByBook).length} libro(s)
                                    </p>
                                </div>
                            </div>

                            {/* Book Selector */}
                            <div>
                                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                                    Asociar todas las notas a un libro (opcional)
                                </label>
                                <div className="relative">
                                    {/* Search Input */}
                                    <div className="relative">
                                        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
                                        <input
                                            ref={searchInputRef}
                                            type="text"
                                            value={selectedBook ? selectedBook.title : bookSearchQuery}
                                            onChange={(e) => {
                                                setBookSearchQuery(e.target.value);
                                                setSelectedBookId('');
                                            }}
                                            onFocus={() => setIsBookSearchFocused(true)}
                                            placeholder="Buscar libro o detectar automáticamente..."
                                            className="w-full pl-11 pr-4 py-3 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-xl text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
                                        />
                                        {selectedBook && (
                                            <button
                                                onClick={() => {
                                                    setSelectedBookId('');
                                                    setBookSearchQuery('');
                                                    searchInputRef.current?.focus();
                                                }}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] rounded-full transition-colors"
                                            >
                                                <X size={14} />
                                            </button>
                                        )}
                                    </div>

                                    {/* Results Dropdown */}
                                    {isBookSearchFocused && !selectedBook && (
                                        <>
                                            <div className="fixed inset-0 z-10" onClick={() => setIsBookSearchFocused(false)} />
                                            <div className="absolute top-full left-0 right-0 mt-2 max-h-64 overflow-y-auto bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-xl shadow-xl z-20">
                                                <button
                                                    onClick={() => { setSelectedBookId(''); setBookSearchQuery(''); setIsBookSearchFocused(false); }}
                                                    className="w-full px-4 py-3 text-left text-sm text-[var(--color-accent)] hover:bg-[var(--color-bg-tertiary)] border-b border-[var(--color-border)]"
                                                >
                                                    ✨ Detectar automáticamente por título
                                                </button>
                                                {filteredBooks.length > 0 ? (
                                                    filteredBooks.map(book => (
                                                        <button
                                                            key={book.id}
                                                            onClick={() => {
                                                                setSelectedBookId(book.id);
                                                                setBookSearchQuery('');
                                                                setIsBookSearchFocused(false);
                                                            }}
                                                            className="w-full px-4 py-3 text-left text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] flex items-center gap-3"
                                                        >
                                                            {book.cover ? (
                                                                <img src={book.cover} alt="" className="w-8 h-10 object-cover rounded flex-shrink-0" />
                                                            ) : (
                                                                <div className="w-8 h-10 bg-[var(--color-bg-tertiary)] rounded flex-shrink-0" />
                                                            )}
                                                            <div className="min-w-0 flex-1">
                                                                <p className="truncate font-medium">{book.title}</p>
                                                                <p className="text-xs text-[var(--color-text-tertiary)] truncate">{book.author}</p>
                                                            </div>
                                                        </button>
                                                    ))
                                                ) : (
                                                    <div className="px-4 py-6 text-center text-sm text-[var(--color-text-tertiary)]">
                                                        No se encontraron libros
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Notes Preview */}
                            <div>
                                <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">Vista previa</h3>
                                <div className="space-y-3 max-h-60 overflow-y-auto">
                                    {Object.entries(notesByBook).slice(0, 5).map(([title, notes]) => (
                                        <div key={title} className="p-3 bg-[var(--color-bg-tertiary)] rounded-lg">
                                            <p className="text-sm font-medium text-[var(--color-text-primary)] mb-1">{title}</p>
                                            <p className="text-xs text-[var(--color-text-tertiary)]">{notes.length} notas</p>
                                            <p className="text-sm text-[var(--color-text-secondary)] mt-2 line-clamp-2 italic">
                                                "{notes[0].quote.slice(0, 100)}..."
                                            </p>
                                        </div>
                                    ))}
                                    {Object.keys(notesByBook).length > 5 && (
                                        <p className="text-xs text-[var(--color-text-tertiary)] text-center py-2">
                                            y {Object.keys(notesByBook).length - 5} libros más...
                                        </p>
                                    )}
                                </div>
                            </div>

                            {error && (
                                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                                    <AlertCircle size={16} />
                                    {error}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Importing Step */}
                    {step === 'importing' && (
                        <div className="flex flex-col items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-accent)]"></div>
                            <p className="mt-4 text-[var(--color-text-secondary)]">Importando notas...</p>
                        </div>
                    )}

                    {/* Complete Step */}
                    {step === 'complete' && importResult && (
                        <div className="space-y-6">
                            <div className="flex flex-col items-center text-center py-6">
                                <div className={`p-4 rounded-full mb-4 ${importResult.success ? 'bg-green-500/20' : 'bg-yellow-500/20'}`}>
                                    {importResult.success ? (
                                        <Check size={24} className="text-green-400" />
                                    ) : (
                                        <AlertCircle size={24} className="text-yellow-400" />
                                    )}
                                </div>
                                <h3 className="text-xl font-semibold text-[var(--color-text-primary)]">
                                    {importResult.success ? '¡Importación completada!' : 'Importación parcial'}
                                </h3>
                                <p className="text-[var(--color-text-secondary)] mt-2">
                                    {importResult.imported} notas importadas
                                    {importResult.skipped > 0 && `, ${importResult.skipped} omitidas`}
                                </p>
                            </div>

                            {importResult.errors.length > 0 && (
                                <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                                    <p className="text-sm font-medium text-yellow-400 mb-2">Advertencias:</p>
                                    <ul className="text-sm text-[var(--color-text-secondary)] space-y-1">
                                        {importResult.errors.slice(0, 5).map((err, i) => (
                                            <li key={i} className="truncate">• {err}</li>
                                        ))}
                                        {importResult.errors.length > 5 && (
                                            <li className="text-[var(--color-text-tertiary)]">
                                                y {importResult.errors.length - 5} más...
                                            </li>
                                        )}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-[var(--color-border)] flex justify-end gap-3">
                    {step === 'upload' && (
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                        >
                            Cancelar
                        </button>
                    )}

                    {step === 'preview' && (
                        <>
                            <button
                                onClick={() => { setStep('upload'); setParsedNotes([]); setError(''); }}
                                className="px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                            >
                                Atrás
                            </button>
                            <button
                                onClick={handleImport}
                                className="px-5 py-2.5 text-sm font-medium bg-[var(--color-accent)] text-white rounded-lg hover:opacity-90 transition-opacity"
                            >
                                Importar {parsedNotes.length} notas
                            </button>
                        </>
                    )}

                    {step === 'complete' && (
                        <button
                            onClick={onClose}
                            className="px-5 py-2.5 text-sm font-medium bg-[var(--color-accent)] text-white rounded-lg hover:opacity-90 transition-opacity"
                        >
                            Cerrar
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
