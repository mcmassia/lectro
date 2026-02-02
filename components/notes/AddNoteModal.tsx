'use client';

import { useState, useRef } from 'react';
import { Book, addAnnotation, Annotation, HighlightColor } from '@/lib/db';
import { useAppStore } from '@/stores/appStore';
import { X, Search, Plus } from 'lucide-react';

interface AddNoteModalProps {
    books: Book[];
    onClose: () => void;
    onSave: () => void;
}

const HIGHLIGHT_COLORS: { value: HighlightColor; label: string; color: string }[] = [
    { value: 'yellow', label: 'Amarillo', color: 'rgba(255, 235, 59, 0.5)' },
    { value: 'green', label: 'Verde', color: 'rgba(76, 175, 80, 0.5)' },
    { value: 'blue', label: 'Azul', color: 'rgba(33, 150, 243, 0.5)' },
    { value: 'pink', label: 'Rosa', color: 'rgba(233, 30, 99, 0.5)' },
    { value: 'orange', label: 'Naranja', color: 'rgba(255, 152, 0, 0.5)' },
];

export function AddNoteModal({ books, onClose, onSave }: AddNoteModalProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedBook, setSelectedBook] = useState<Book | null>(null);
    const [noteContent, setNoteContent] = useState('');
    const [selectedColor, setSelectedColor] = useState<HighlightColor>('yellow');
    const [isSaving, setIsSaving] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const searchRef = useRef<HTMLInputElement>(null);
    const { currentUser } = useAppStore();

    const filteredBooks = books.filter(book =>
        book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (book.author && book.author.toLowerCase().includes(searchQuery.toLowerCase()))
    ).slice(0, 10);

    const handleSelectBook = (book: Book) => {
        setSelectedBook(book);
        setSearchQuery(book.title);
        setShowDropdown(false);
    };

    const handleSave = async () => {
        if (!selectedBook || !noteContent.trim() || !currentUser) return;

        setIsSaving(true);
        try {
            const newAnnotation: Annotation = {
                id: crypto.randomUUID(),
                bookId: selectedBook.id,
                userId: currentUser.id,
                cfi: '',
                text: '',
                note: noteContent.trim(),
                color: selectedColor,
                chapterTitle: 'Nota Manual',
                createdAt: new Date(),
                updatedAt: new Date()
            };

            await addAnnotation(newAnnotation);
            onSave();
            onClose();
        } catch (error) {
            console.error('Error saving note:', error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <>
            <div className="modal-overlay" onClick={onClose} />
            <div className="add-note-modal">
                <div className="modal-header">
                    <h2>Añadir Nota</h2>
                    <button className="close-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="modal-body">
                    {/* Book Selector */}
                    <div className="form-group">
                        <label>Libro</label>
                        <div className="book-search-container">
                            <div className="search-input-wrapper">
                                <Search size={16} className="search-icon" />
                                <input
                                    ref={searchRef}
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        setShowDropdown(true);
                                        if (!e.target.value) setSelectedBook(null);
                                    }}
                                    onFocus={() => setShowDropdown(true)}
                                    placeholder="Buscar libro..."
                                    className="search-input"
                                />
                            </div>

                            {showDropdown && searchQuery && filteredBooks.length > 0 && (
                                <div className="book-dropdown">
                                    {filteredBooks.map(book => (
                                        <button
                                            key={book.id}
                                            className={`book-option ${selectedBook?.id === book.id ? 'selected' : ''}`}
                                            onClick={() => handleSelectBook(book)}
                                        >
                                            <div className="book-cover-mini">
                                                <img
                                                    src={book.isOnServer || book.filePath
                                                        ? `/api/covers/${book.id}?width=40`
                                                        : (book.cover || '/default-cover.png')}
                                                    alt=""
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).src = '/default-cover.png';
                                                    }}
                                                />
                                            </div>
                                            <div className="book-info">
                                                <span className="book-title">{book.title}</span>
                                                <span className="book-author">{book.author}</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Color Selector */}
                    <div className="form-group">
                        <label>Color</label>
                        <div className="color-options">
                            {HIGHLIGHT_COLORS.map(({ value, label, color }) => (
                                <button
                                    key={value}
                                    className={`color-btn ${selectedColor === value ? 'selected' : ''}`}
                                    style={{ backgroundColor: color }}
                                    onClick={() => setSelectedColor(value)}
                                    title={label}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Note Content */}
                    <div className="form-group">
                        <label>Nota</label>
                        <textarea
                            value={noteContent}
                            onChange={(e) => setNoteContent(e.target.value)}
                            placeholder="Escribe tu nota..."
                            rows={6}
                            className="note-textarea"
                        />
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="btn btn-ghost" onClick={onClose}>
                        Cancelar
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={handleSave}
                        disabled={!selectedBook || !noteContent.trim() || isSaving}
                    >
                        <Plus size={16} />
                        {isSaving ? 'Guardando...' : 'Añadir Nota'}
                    </button>
                </div>
            </div>

            <style jsx>{`
                .modal-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.6);
                    z-index: 1000;
                    backdrop-filter: blur(4px);
                }

                .add-note-modal {
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 100%;
                    max-width: 500px;
                    background: var(--color-bg-secondary);
                    border-radius: 16px;
                    border: 1px solid var(--color-border);
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                    z-index: 1001;
                    overflow: hidden;
                    animation: modalIn 0.2s ease-out;
                }

                @keyframes modalIn {
                    from {
                        opacity: 0;
                        transform: translate(-50%, -48%);
                    }
                    to {
                        opacity: 1;
                        transform: translate(-50%, -50%);
                    }
                }

                .modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 20px 24px;
                    border-bottom: 1px solid var(--color-border);
                }

                .modal-header h2 {
                    font-size: 18px;
                    font-weight: 600;
                    margin: 0;
                }

                .close-btn {
                    background: transparent;
                    border: none;
                    color: var(--color-text-secondary);
                    cursor: pointer;
                    padding: 4px;
                    border-radius: 6px;
                    transition: all 0.2s;
                }

                .close-btn:hover {
                    color: var(--color-text-primary);
                    background: var(--color-bg-tertiary);
                }

                .modal-body {
                    padding: 24px;
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                }

                .form-group {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .form-group label {
                    font-size: 13px;
                    font-weight: 500;
                    color: var(--color-text-secondary);
                }

                .book-search-container {
                    position: relative;
                }

                .search-input-wrapper {
                    position: relative;
                    display: flex;
                    align-items: center;
                }

                .search-icon {
                    position: absolute;
                    left: 12px;
                    color: var(--color-text-tertiary);
                    pointer-events: none;
                }

                .search-input {
                    width: 100%;
                    padding: 12px 12px 12px 40px;
                    border: 1px solid var(--color-border);
                    border-radius: 10px;
                    background: var(--color-bg-tertiary);
                    color: var(--color-text-primary);
                    font-size: 14px;
                    transition: all 0.2s;
                }

                .search-input:focus {
                    outline: none;
                    border-color: var(--color-accent);
                }

                .search-input::placeholder {
                    color: var(--color-text-tertiary);
                }

                .book-dropdown {
                    position: absolute;
                    top: calc(100% + 4px);
                    left: 0;
                    right: 0;
                    background: var(--color-bg-elevated);
                    border: 1px solid var(--color-border);
                    border-radius: 12px;
                    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
                    max-height: 240px;
                    overflow-y: auto;
                    z-index: 10;
                }

                .book-option {
                    width: 100%;
                    padding: 10px 14px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    border: none;
                    background: transparent;
                    cursor: pointer;
                    text-align: left;
                    transition: background 0.15s;
                }

                .book-option:hover {
                    background: var(--color-bg-tertiary);
                }

                .book-option.selected {
                    background: var(--color-accent)/10;
                }

                .book-cover-mini {
                    width: 32px;
                    height: 48px;
                    border-radius: 4px;
                    overflow: hidden;
                    flex-shrink: 0;
                    background: var(--color-bg-tertiary);
                }

                .book-cover-mini img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                .book-info {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                    min-width: 0;
                }

                .book-title {
                    font-size: 13px;
                    font-weight: 500;
                    color: var(--color-text-primary);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .book-author {
                    font-size: 11px;
                    color: var(--color-text-secondary);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .color-options {
                    display: flex;
                    gap: 10px;
                }

                .color-btn {
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    border: 2px solid transparent;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .color-btn:hover {
                    transform: scale(1.1);
                }

                .color-btn.selected {
                    border-color: var(--color-text-primary);
                    box-shadow: 0 0 0 2px var(--color-bg-secondary);
                }

                .note-textarea {
                    width: 100%;
                    padding: 14px;
                    border: 1px solid var(--color-border);
                    border-radius: 10px;
                    background: var(--color-bg-tertiary);
                    color: var(--color-text-primary);
                    font-size: 14px;
                    line-height: 1.6;
                    resize: vertical;
                    min-height: 120px;
                    font-family: inherit;
                    transition: border-color 0.2s;
                }

                .note-textarea:focus {
                    outline: none;
                    border-color: var(--color-accent);
                }

                .note-textarea::placeholder {
                    color: var(--color-text-tertiary);
                }

                .modal-footer {
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                    padding: 16px 24px;
                    border-top: 1px solid var(--color-border);
                    background: var(--color-bg-tertiary);
                }

                .btn {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 10px 18px;
                    border-radius: 10px;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                    border: none;
                }

                .btn-ghost {
                    background: transparent;
                    color: var(--color-text-secondary);
                }

                .btn-ghost:hover {
                    background: var(--color-bg-elevated);
                    color: var(--color-text-primary);
                }

                .btn-primary {
                    background: var(--color-accent);
                    color: white;
                }

                .btn-primary:hover:not(:disabled) {
                    filter: brightness(1.1);
                }

                .btn-primary:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
            `}</style>
        </>
    );
}
