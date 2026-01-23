'use client';

import { useState, useRef, useEffect } from 'react';
import { Book, updateBook, getAllTags, Tag, BookCategory, UserBookRating } from '@/lib/db';
import { useLibraryStore } from '@/stores/appStore';
import { useRouter } from 'next/navigation';
import { searchGoogleBooks, searchMetadata, findCovers, MetadataResult } from '@/lib/metadata';
import { MetadataSelector } from './MetadataSelector';

interface BookDetailsModalProps {
    book: Book;
    onClose: () => void;
}

// Categorías temáticas con iconos
const CATEGORIES: { id: BookCategory; icon: string; label: string }[] = [
    { id: 'Pensamiento', icon: '🧠', label: 'Pensamiento' },
    { id: 'Espiritualidad', icon: '✨', label: 'Espiritualidad' },
    { id: 'Sociedad', icon: '🌍', label: 'Sociedad' },
    { id: 'Ciencia', icon: '🔬', label: 'Ciencia' },
    { id: 'Tecnología', icon: '💻', label: 'Tecnología' },
    { id: 'Narrativa', icon: '📖', label: 'Narrativa' },
    { id: 'PoesíaDrama', icon: '🎭', label: 'Poesía/Drama' },
    { id: 'ArteCultura', icon: '🎨', label: 'Arte/Cultura' },
    { id: 'Crecimiento', icon: '🌱', label: 'Crecimiento' },
    { id: 'Práctica', icon: '🔧', label: 'Práctica' },
];

// Valoraciones personales del usuario
const USER_RATINGS: { id: UserBookRating; icon: string; label: string; desc: string }[] = [
    { id: 'imprescindible', icon: '💎', label: 'Imprescindible', desc: 'Cambió tu forma de pensar' },
    { id: 'favorito', icon: '❤️', label: 'Favorito', desc: 'Placer estético/emocional alto' },
    { id: 'referencia', icon: '⭐', label: 'Referencia', desc: 'Consulta recurrente' },
    { id: 'releer', icon: '⏳', label: 'Releer', desc: 'Requiere múltiples lecturas' },
    { id: 'correcto', icon: '♻️', label: 'Correcto', desc: 'Decente pero no memorable' },
    { id: 'prescindible', icon: '🚮', label: 'Prescindible', desc: 'Sin valor real futuro' },
];


export function BookDetailsModal({ book: initialBook, onClose }: BookDetailsModalProps) {
    const [book, setBook] = useState<Book>(initialBook);
    const [isEditing, setIsEditing] = useState(false);

    // Metadata Search State
    const [showMetadataSelector, setShowMetadataSelector] = useState(false);
    const [searchResults, setSearchResults] = useState<MetadataResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    // Cover Search State
    const [showCoverSelector, setShowCoverSelector] = useState(false);
    const [coverResults, setCoverResults] = useState<string[]>([]);
    const [isSearchingCovers, setIsSearchingCovers] = useState(false);

    const [availableTags, setAvailableTags] = useState<Tag[]>([]);
    const [tagInput, setTagInput] = useState('');

    const { updateBook: updateBookInStore } = useLibraryStore();
    const router = useRouter();
    const modalRef = useRef<HTMLDivElement>(null);

    // Focus modal on mount for accessibility and keyboard events
    useEffect(() => {
        if (modalRef.current) {
            modalRef.current.focus();
        }
    }, []);

    // Global Paste Handler
    useEffect(() => {
        const handleGlobalPaste = async (e: ClipboardEvent) => {
            // Ignore if focus is inside an input or textarea
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                return;
            }

            const items = e.clipboardData?.items;
            if (!items) return;

            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    const blob = items[i].getAsFile();
                    if (blob) {
                        const reader = new FileReader();
                        reader.onload = async (event) => {
                            const base64 = event.target?.result as string;
                            if (base64) {
                                // Update local state immediately for feedback
                                setBook(prev => ({ ...prev, cover: base64 }));
                                setIsEditing(true); // Switch to edit mode to allow saving

                                // Optional: Auto-save or wait for user?
                                // Let's auto-save the cover to DB but keep "editing" state for consistency if they want to change others
                                // actually, previous behavior was immediate save. Let's keep immediate save for cover paste to match expectation of "just works"
                                // BUT the code I'm replacing had immediate save. The issue was focus. 
                                // Let's do immediate save for UX but also update IsEditing so they see it's "live".

                                try {
                                    await updateBook(book.id, { cover: base64 });
                                    updateBookInStore(book.id, { cover: base64 });
                                } catch (err) {
                                    console.error('Failed to auto-save pasted cover:', err);
                                    alert('Failed to save cover image.');
                                }
                            }
                        };
                        reader.readAsDataURL(blob);
                    }
                    // Prevent default to avoid double-pasting if focus happens to be in a weird spot
                    e.preventDefault();
                }
            }
        };

        // We use document instead of window for better compatibility in some contexts, though window is fine too.
        document.addEventListener('paste', handleGlobalPaste);
        return () => document.removeEventListener('paste', handleGlobalPaste);
    }, [book.id, updateBookInStore]); // Dependencies


    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Element;
            // Ignore if click is inside modal OR inside any selector overlay
            if (
                modalRef.current &&
                !modalRef.current.contains(event.target as Node) &&
                !target.closest('.selector-overlay')
            ) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    useEffect(() => {
        getAllTags().then(setAvailableTags);
    }, []);

    const handleStatusChange = async (status: Book['status']) => {
        try {
            await updateBook(book.id, { status });
            updateBookInStore(book.id, { status });
            setBook({ ...book, status });
        } catch (error) {
            console.error('Failed to update status:', error);
        }
    };

    const toggleFavorite = async () => {
        try {
            const newIsFavorite = !book.isFavorite;
            await updateBook(book.id, { isFavorite: newIsFavorite });
            updateBookInStore(book.id, { isFavorite: newIsFavorite });
            setBook({ ...book, isFavorite: newIsFavorite });
        } catch (error) {
            console.error('Failed to update favorite:', error);
        }
    };

    const handleSearchMetadata = async () => {
        if (isSearching) return;
        setIsSearching(true);
        try {
            const query = `${book.title} ${book.author}`;
            const results = await searchMetadata(query);

            if (results.length === 0) {
                alert('No metadata found for this book.');
                return;
            }

            setSearchResults(results);
            setShowMetadataSelector(true);
        } catch (error) {
            console.error('Metadata search failed:', error);
            alert('Failed to search metadata.');
        } finally {
            setIsSearching(false);
        }
    };

    const handleSelectMetadata = (result: MetadataResult) => {
        const updates: Partial<Book> = {
            author: result.author || book.author,
            title: result.title || book.title, // Optionally update title too
            metadata: {
                ...book.metadata,
                description: result.description || book.metadata?.description,
                publisher: result.publisher || book.metadata?.publisher,
                publishedDate: result.publishedDate || book.metadata?.publishedDate,
                language: result.language || book.metadata?.language,
                tags: result.tags || book.metadata?.tags
            }
        };

        if (result.cover && !book.cover) {
            updates.cover = result.cover;
        } else if (result.cover && book.cover) {
            // If book already has cover, maybe ask? Or just let user choose via cover selector?
            // For now, let's update it if the user explicitly selected this metadata result.
            updates.cover = result.cover;
        }

        // Apply updates to local state only (Explicit Save required)
        setBook({ ...book, ...updates });
        setIsEditing(true); // Switch to edit mode so user can review/save
        setShowMetadataSelector(false);
    };

    const handleSearchCovers = async () => {
        setIsSearchingCovers(true);
        try {
            const query = `${book.title} ${book.author}`;
            const results = await findCovers(query);
            setCoverResults(results);
            setShowCoverSelector(true);
        } catch (error) {
            console.error('Cover search failed:', error);
            alert('Failed to search covers.');
        } finally {
            setIsSearchingCovers(false);
        }
    };

    const handleSelectCover = (coverUrl: string) => {
        setBook({ ...book, cover: coverUrl });
        setIsEditing(true); // Switch to edit mode
        setShowCoverSelector(false);
    };

    // Old handlePaste removed in favor of global listener

    const handleRead = () => {
        router.push(`/reader/${book.id}`);
    };

    const handleDownload = () => {
        // Create a download link for the blob
        if (book.fileBlob) {
            const url = URL.createObjectURL(book.fileBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = book.fileName || `${book.title}.epub`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    };

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return '-';
        try {
            return new Date(dateString).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch (e) {
            return dateString;
        }
    };

    return (
        <div className="modal-overlay open">
            <div
                className="modal-container"
                ref={modalRef}
                tabIndex={-1} // Make it focusable programmatically
                style={{ outline: 'none' }} // Remove focus ring
            >
                <button className="close-btn" onClick={onClose}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>

                <div className="modal-content">
                    <div
                        className="cover-section"
                        // onPaste removed - using global listener
                        title="Paste image (Ctrl+V) anywhere in modal"
                    >
                        <div className="book-cover-wrapper">
                            {book.cover ? (
                                <img src={book.cover} alt={book.title} className="book-cover" />
                            ) : (
                                <div className="book-cover-placeholder">
                                    <span>{book.title[0]}</span>
                                </div>
                            )}
                            <div className="cover-overlay">
                                <span>Paste image (Ctrl+V)</span>
                                <button
                                    className="btn-xs btn-find-cover"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleSearchCovers();
                                    }}
                                >
                                    {isSearchingCovers ? 'Searching...' : 'Find Cover'}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="info-section">
                        <div className="header-info">
                            {isEditing ? (
                                <div className="edit-form-group">
                                    <input
                                        className="edit-input author-input"
                                        value={book.author}
                                        onChange={(e) => setBook({ ...book, author: e.target.value })}
                                        placeholder="Author"
                                    />
                                    <input
                                        className="edit-input title-input"
                                        value={book.title}
                                        onChange={(e) => setBook({ ...book, title: e.target.value })}
                                        placeholder="Title"
                                    />
                                </div>
                            ) : (
                                <>
                                    <h2 className="author-name">{book.author}</h2>
                                    <h1 className="book-title">{book.title}</h1>
                                </>
                            )}
                        </div>

                        <div className="action-buttons">
                            <button className="btn btn-primary btn-read" onClick={handleRead}>
                                Read
                            </button>
                            {!book.isOnServer && (
                                <button className="btn btn-secondary btn-download" onClick={async () => {
                                    try {
                                        if (confirm('¿Subir este libro al servidor?')) {
                                            const { uploadBookToServer } = await import('@/lib/fileSystem');
                                            await uploadBookToServer(book);
                                            // Update local state to hide button immediately
                                            // We might need to mutate the book object or refetch
                                            // For now, let's just alert and re-open or let the user close
                                            alert('Libro subido correctamente al servidor.');
                                            onClose(); // Close modal to force refresh when re-opening? Or trigger a refresh callback?
                                        }
                                    } catch (e) {
                                        alert('Error al subir libro: ' + (e as Error).message);
                                    }
                                }}>
                                    Subir a Cloud
                                </button>
                            )}
                            <button className="btn btn-secondary btn-download" onClick={handleDownload}>
                                Download ({formatFileSize(book.fileSize)})
                            </button>
                        </div>

                        <div className="description-section">
                            <h3 className="section-label">Description</h3>
                            {isEditing ? (
                                <textarea
                                    className="edit-textarea"
                                    value={book.metadata?.description || ''}
                                    onChange={(e) => setBook({
                                        ...book,
                                        metadata: { ...book.metadata, description: e.target.value }
                                    })}
                                    placeholder="Description..."
                                />
                            ) : (
                                <div className="description-text">
                                    {book.metadata?.description || 'No description available.'}
                                </div>
                            )}
                        </div>

                        <div className="metadata-grid">
                            <div className="metadata-item">
                                <span className="meta-label">Publication Date</span>
                                {isEditing ? (
                                    <input
                                        type="date"
                                        className="edit-input-sm"
                                        value={book.metadata?.publishedDate || ''}
                                        onChange={(e) => setBook({
                                            ...book,
                                            metadata: { ...book.metadata, publishedDate: e.target.value }
                                        })}
                                    />
                                ) : (
                                    <span className="meta-value">{formatDate(book.metadata?.publishedDate)}</span>
                                )}
                            </div>
                            <div className="metadata-item">
                                <span className="meta-label">Language</span>
                                {isEditing ? (
                                    <input
                                        className="edit-input-sm"
                                        value={book.metadata?.language || ''}
                                        onChange={(e) => setBook({
                                            ...book,
                                            metadata: { ...book.metadata, language: e.target.value }
                                        })}
                                    />
                                ) : (
                                    <span className="meta-value">{book.metadata?.language || '-'}</span>
                                )}
                            </div>
                            <div className="metadata-item">
                                <span className="meta-label">Format</span>
                                <span className="meta-value upp">{book.format}</span>
                            </div>
                            <div className="metadata-item">
                                <span className="meta-label">Publisher</span>
                                {isEditing ? (
                                    <input
                                        className="edit-input-sm"
                                        value={book.metadata?.publisher || ''}
                                        onChange={(e) => setBook({
                                            ...book,
                                            metadata: { ...book.metadata, publisher: e.target.value }
                                        })}
                                    />
                                ) : (
                                    <span className="meta-value">{book.metadata?.publisher || '-'}</span>
                                )}
                            </div>
                        </div>

                        {/* Etiquetas (Categorías Temáticas) */}
                        <div className="category-section">
                            <h3 className="section-label">
                                Etiquetas
                                {(!book.metadata?.categories || book.metadata.categories.length === 0) && (
                                    <span className="category-warning" title="Sin etiquetas asignadas">
                                        ⚠️
                                    </span>
                                )}
                            </h3>
                            <div className="category-selector">
                                {CATEGORIES.map(cat => {
                                    const isActive = book.metadata?.categories?.includes(cat.id) || false;
                                    return (
                                        <button
                                            key={cat.id}
                                            className={`category-chip ${isActive ? 'active' : ''}`}
                                            onClick={async () => {
                                                // Toggle logic respecting manual categories
                                                const currentCategories = new Set(book.metadata?.categories || []);
                                                const currentManual = new Set(book.metadata?.manualCategories || []);

                                                if (isActive) {
                                                    // Removing: remove from both lists
                                                    currentCategories.delete(cat.id);
                                                    currentManual.delete(cat.id);
                                                } else {
                                                    // Adding: add to both lists (explicit user action = manual)
                                                    currentCategories.add(cat.id);
                                                    currentManual.add(cat.id);
                                                }

                                                const newCategories = Array.from(currentCategories);
                                                const newManual = Array.from(currentManual);

                                                const newMetadata = {
                                                    ...book.metadata,
                                                    categories: newCategories,
                                                    manualCategories: newManual
                                                };

                                                setBook({ ...book, metadata: newMetadata });
                                                try {
                                                    await updateBook(book.id, { metadata: newMetadata });
                                                    updateBookInStore(book.id, { metadata: newMetadata });
                                                } catch (e) {
                                                    console.error('Failed to update categories:', e);
                                                }
                                            }}
                                        >
                                            <span className="cat-icon">{cat.icon}</span>
                                            <span className="cat-label">{cat.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Valoración Personal */}
                        <div className="rating-section">
                            <h3 className="section-label">Tu Valoración</h3>
                            <div className="rating-selector">
                                {USER_RATINGS.map(rating => (
                                    <button
                                        key={rating.id}
                                        className={`rating-chip ${book.metadata?.userRating === rating.id ? 'active' : ''}`}
                                        onClick={async () => {
                                            // Toggle: si ya está seleccionado, deseleccionar
                                            const newRating = book.metadata?.userRating === rating.id ? undefined : rating.id;
                                            const newMetadata = { ...book.metadata, userRating: newRating };
                                            setBook({ ...book, metadata: newMetadata });
                                            try {
                                                await updateBook(book.id, { metadata: newMetadata });
                                                updateBookInStore(book.id, { metadata: newMetadata });
                                            } catch (e) {
                                                console.error('Failed to update rating:', e);
                                            }
                                        }}
                                        title={rating.desc}
                                    >
                                        <span className="rating-icon">{rating.icon}</span>
                                        <span className="rating-label">{rating.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="modal-footer">
                    <div className="status-dropdown-wrapper">
                        <select
                            className="status-select"
                            value={book.status || 'planToRead'}
                            onChange={(e) => handleStatusChange(e.target.value as Book['status'])}
                        >
                            <option value="unread">No leído</option>
                            <option value="interesting">Interesante</option>
                            <option value="planToRead">Para leer</option>
                            <option value="reading">Leyendo</option>
                            <option value="completed">Leído</option>
                            <option value="re_read">Volver a leer</option>
                        </select>
                    </div>

                    <div className="footer-actions">
                        <button
                            className="btn-icon"
                            onClick={handleSearchMetadata}
                            title="Find Metadata"
                            disabled={isSearching}
                        >
                            {isSearching ? (
                                <svg className="animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                                </svg>
                            ) : (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                                    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                                    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                                    <path d="M21 5c0 1.66-4 3-9 3s-9-1.34-9-3" />
                                </svg>
                            )}
                        </button>
                        <button
                            className={`btn-icon ${isEditing ? 'active-edit' : ''}`}
                            onClick={async (e) => {
                                e.preventDefault();
                                e.stopPropagation();

                                alert(`Click! Editing mode: ${isEditing}`);

                                if (isEditing) {
                                    // Save changes
                                    console.log('Saving book changes...', book);
                                    alert('Starting save process...');
                                    try {
                                        // Robust save: ensure metadata structure is valid
                                        const cleanMetadata = {
                                            ...(book.metadata || {}),
                                            description: book.metadata?.description || '',
                                            publisher: book.metadata?.publisher || '',
                                            publishedDate: book.metadata?.publishedDate || '',
                                            language: book.metadata?.language || '',
                                            tags: book.metadata?.tags || [],
                                            categories: book.metadata?.categories || [],
                                        };

                                        const updatedCount = await updateBook(book.id, {
                                            title: book.title || 'Untitled',
                                            author: book.author || 'Unknown Author',
                                            cover: book.cover,
                                            metadata: cleanMetadata
                                        });

                                        alert(`DB Update finished. Count: ${updatedCount}`);

                                        updateBookInStore(book.id, {
                                            title: book.title,
                                            author: book.author,
                                            cover: book.cover,
                                            metadata: cleanMetadata
                                        });
                                        alert('Store updated.');

                                    } catch (err: any) {
                                        console.error('Failed to save book:', err);
                                        const msg = err?.message || (typeof err === 'string' ? err : 'Unknown error');
                                        alert(`Failed to save changes: ${msg}`);
                                        // Do NOT exit edit mode if save failed
                                        return;
                                    }
                                }
                                setIsEditing(!isEditing);
                            }}
                            title={isEditing ? "Save Metadata" : "Edit Metadata"}
                        >
                            {isEditing ? (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                                    <polyline points="17 21 17 13 7 13 7 21" />
                                    <polyline points="7 3 7 8 15 8" />
                                </svg>
                            ) : (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                            )}
                        </button>
                        {isEditing && (
                            <button
                                className="btn-icon"
                                onClick={() => {
                                    if (confirm('Revert all changes to original metadata?')) {
                                        setBook(initialBook);
                                        setIsEditing(false);
                                    }
                                }}
                                title="Revert Changes"
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                                    <path d="M3 3v5h5" />
                                </svg>
                            </button>
                        )}
                        <button className="btn-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                                <circle cx="12" cy="12" r="1" />
                                <circle cx="19" cy="12" r="1" />
                                <circle cx="5" cy="12" r="1" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>


            {
                showMetadataSelector && (
                    <div className="selector-overlay">
                        <div className="selector-container">
                            <MetadataSelector
                                results={searchResults}
                                onSelect={handleSelectMetadata}
                                onCancel={() => setShowMetadataSelector(false)}
                            />
                        </div>
                    </div>
                )
            }

            {
                showCoverSelector && (
                    <div className="selector-overlay">
                        <div className="selector-container cover-selector-container">
                            <div className="selector-header">
                                <h3>Select Cover</h3>
                                <button className="close-btn" onClick={() => setShowCoverSelector(false)}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                                        <line x1="18" y1="6" x2="6" y2="18" />
                                        <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                </button>
                            </div>
                            {isSearchingCovers ? (
                                <div className="loading-state">
                                    <svg className="animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                                    </svg>
                                    <span>Searching covers...</span>
                                </div>
                            ) : coverResults.length > 0 ? (
                                <div className="cover-grid">
                                    {coverResults.map((url, i) => (
                                        <div key={i} className="cover-option" onClick={() => handleSelectCover(url)}>
                                            <img src={url} alt={`Cover option ${i + 1}`} />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="no-results">No covers found</div>
                            )}
                        </div>
                    </div>
                )
            }

            <style jsx>{`
                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.7);
                    backdrop-filter: blur(4px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                    padding: var(--space-4);
                    animation: fadeIn 0.2s ease-out;
                }

                .modal-container {
                    background: #1a1b1e; /* Dark theme background */
                    border-radius: var(--radius-lg);
                    width: 100%;
                    max-width: 800px;
                    max-height: 90vh;
                    display: flex;
                    flex-direction: column;
                    position: relative;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                    color: #fff;
                    overflow: hidden;
                }

                .close-btn {
                    position: absolute;
                    top: var(--space-4);
                    right: var(--space-4);
                    background: transparent;
                    border: none;
                    color: rgba(255,255,255,0.5);
                    cursor: pointer;
                    z-index: 10;
                    padding: var(--space-2);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                }

                .close-btn:hover {
                    background: rgba(255,255,255,0.1);
                    color: #fff;
                }

                .modal-content {
                    display: grid;
                    grid-template-columns: 300px 1fr;
                    gap: var(--space-8);
                    padding: var(--space-8);
                    overflow-y: auto;
                }

                .book-cover-wrapper {
                    width: 100%;
                    aspect-ratio: 2/3;
                    border-radius: var(--radius-md);
                    overflow: hidden;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                }

                .book-cover {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                .cover-section:focus {
                    outline: none;
                }
                
                .cover-section:focus .book-cover-wrapper {
                     box-shadow: 0 0 0 2px var(--color-accent);
                }

                .cover-overlay {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    background: rgba(0,0,0,0.6);
                    padding: 4px;
                    text-align: center;
                    opacity: 0;
                    transition: opacity 0.2s;
                    color: white;
                    font-size: 10px;
                }

                .book-cover-wrapper:hover .cover-overlay {
                    opacity: 1;
                }

                .book-cover-placeholder {
                    width: 100%;
                    height: 100%;
                    background: var(--gradient-cool);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: var(--text-6xl);
                    font-weight: 700;
                    color: rgba(255,255,255,0.5);
                }

                .info-section {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-6);
                }

                .header-info {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-2);
                }

                .author-name {
                    font-size: var(--text-sm);
                    color: rgba(255,255,255,0.7);
                    font-weight: 500;
                    margin: 0;
                }

                .book-title {
                    font-size: var(--text-3xl);
                    font-weight: 700;
                    margin: 0;
                    line-height: 1.2;
                }

                .action-buttons {
                    display: flex;
                    gap: var(--space-4);
                }

                .btn {
                    flex: 1;
                    height: 44px;
                    border-radius: var(--radius-full);
                    font-weight: 600;
                    font-size: var(--text-sm);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                    border: none;
                }

                .btn-primary {
                    background: var(--color-accent);
                    color: white;
                }

                .btn-primary:hover {
                    opacity: 0.9;
                }

                .btn-secondary {
                    background: rgba(255,255,255,0.1);
                    color: white;
                    border: 1px solid rgba(255,255,255,0.1);
                }

                .btn-secondary:hover {
                    background: rgba(255,255,255,0.15);
                }

                .metadata-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: var(--space-6);
                    padding: var(--space-6) 0;
                    border-top: 1px solid rgba(255,255,255,0.1);
                    border-bottom: 1px solid rgba(255,255,255,0.1);
                }

                .metadata-item {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-1);
                }

                .metadata-label {
                    font-size: var(--text-xs);
                    color: rgba(255,255,255,0.5);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .metadata-value {
                    font-size: var(--text-sm);
                    color: #fff;
                }
                
                .tags-section {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-3);
                }
                
                .tags-list {
                    display: flex;
                    flex-wrap: wrap;
                    gap: var(--space-2);
                }
                
                .tag {
                    font-size: var(--text-xs);
                    padding: 4px 10px;
                    border-radius: 99px;
                    background: rgba(255,255,255,0.1);
                    color: rgba(255,255,255,0.8);
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                
                .tag-remove {
                    cursor: pointer;
                    opacity: 0.6;
                    display: flex;
                    align-items: center;
                }
                .tag-remove:hover { opacity: 1; }
                
                .quick-tags {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 6px;
                    margin-top: 8px;
                }
                
                .tag-suggestion {
                    font-size: 10px;
                    padding: 2px 8px;
                    border-radius: 99px;
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.1);
                    color: rgba(255,255,255,0.6);
                    cursor: pointer;
                }
                .tag-suggestion:hover {
                    background: rgba(255,255,255,0.1);
                    color: white;
                    border-color: rgba(255,255,255,0.2);
                }
                
                .description h4, .tags-section h4 {
                    font-size: var(--text-sm);
                    color: rgba(255,255,255,0.5);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    margin: 0 0 var(--space-2) 0;
                }

                .description p {
                    font-size: var(--text-sm);
                    line-height: 1.6;
                    color: rgba(255,255,255,0.8);
                    white-space: pre-wrap;
                }

                .status-dropdown-wrapper {
                    position: relative;
                    min-width: 140px;
                }
                
                .status-dropdown-wrapper::after {
                    content: '';
                    position: absolute;
                    top: 0; bottom: 0; right: 0; left: 0;
                    pointer-events: none;
                }

                .status-select {
                    background: rgba(255,255,255,0.1);
                    border: none;
                    color: #fff;
                    padding: 8px 16px;
                    border-radius: var(--radius-md);
                    font-size: var(--text-sm);
                    cursor: pointer;
                    appearance: none;
                    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
                    background-repeat: no-repeat;
                    background-position: right 8px center;
                    background-size: 16px;
                    padding-right: 32px;
                }
                
                .footer-actions {
                    display: flex;
                    gap: var(--space-2);
                }

                .btn-read {
                    background: #3b82f6;
                    color: white;
                    border: none;
                }

                .btn-read:hover {
                    background: #2563eb;
                }

                .btn-download {
                    background: transparent;
                    color: #3b82f6;
                    border: 1px solid #3b82f6;
                }

                .btn-download:hover {
                    background: rgba(59, 130, 246, 0.1);
                }

                .section-label {
                    font-size: var(--text-sm);
                    color: rgba(255,255,255,0.5);
                    margin-bottom: var(--space-2);
                    font-weight: 500;
                }

                .description-text {
                    font-size: var(--text-sm);
                    line-height: 1.6;
                    color: rgba(255,255,255,0.9);
                    max-height: 150px;
                    overflow-y: auto;
                }

                .edit-input, .edit-textarea {
                    background-color: #25262b;
                    border: 1px solid #373a40;
                    color: #fff;
                    padding: 8px 12px;
                    border-radius: var(--radius-md);
                    font-size: var(--text-sm);
                    width: 100%;
                    font-family: inherit;
                    display: block;
                }

                .edit-input:focus, .edit-textarea:focus {
                    outline: none;
                    border-color: var(--color-accent);
                    background-color: #2c2e33;
                }

                .author-input {
                    font-size: var(--text-sm);
                    font-weight: 500;
                    margin-bottom: 4px;
                }

                .title-input {
                    font-size: var(--text-xl);
                    font-weight: 700;
                    margin-bottom: 8px;
                }

                .edit-textarea {
                    min-height: 100px;
                    resize: vertical;
                    line-height: 1.6;
                }

                .edit-input-sm {
                    background-color: #25262b;
                    border: 1px solid #373a40;
                    color: #fff;
                    padding: 6px 10px;
                    border-radius: var(--radius-sm);
                    font-size: var(--text-sm);
                    width: 100%;
                }

                .edit-input-sm:focus {
                    outline: none;
                    border-color: var(--color-accent);
                }

                /* Fix date inputs on dark mode */
                input[type="date"] {
                    color-scheme: dark;
                }


                .tag-chip-edit {
                    background: rgba(255,255,255,0.1);
                    padding: 2px 8px;
                    border-radius: 4px;
                    font-size: 12px;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }
                
                .tag-remove-btn {
                    background: none;
                    border: none;
                    color: rgba(255,255,255,0.5);
                    cursor: pointer;
                    padding: 0 2px;
                }
                .tag-remove-btn:hover { color: white; }

                .tag-input-wrapper {
                    display: flex;
                    gap: 4px;
                }

                .quick-tags {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 4px;
                    margin-top: 4px;
                }
                
                .tag-suggestion {
                    background: none;
                    border: 1px solid rgba(255,255,255,0.2);
                    padding: 2px 6px;
                    border-radius: 99px;
                    font-size: 11px;
                    color: rgba(255,255,255,0.6);
                    cursor: pointer;
                }
                .tag-suggestion:hover {
                    border-color: rgba(255,255,255,0.5);
                    color: white;
                }
                .tag {
            background: rgba(255,255,255,0.1);
            color: rgba(255,255,255,0.8);
            padding: 4px 12px;
            border-radius: var(--radius-full);
            font-size: var(--text-xs);
            font-weight: 500;
                }

            .tag.aventuras {color: #facc15; background: rgba(250, 204, 21, 0.1); }
            .tag.belico {color: #f87171; background: rgba(248, 113, 113, 0.1); }
            .tag.historico {color: #a3e635; background: rgba(163, 230, 53, 0.1); }

            .tags-edit-container {
                display: flex;
            flex-direction: column;
            gap: 8px;
                }

            .current-tags-edit {
                display: flex;
            flex-wrap: wrap;
            gap: 4px;
                }

            .tag-chip-edit {
                background: rgba(255,255,255,0.1);
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 12px;
            display: flex;
            align-items: center;
            gap: 4px;
                }

            .tag-remove-btn {
                background: none;
            border: none;
            color: rgba(255,255,255,0.5);
            cursor: pointer;
            padding: 0 2px;
                }
            .tag-remove-btn:hover {color: white; }

            .tag-input-wrapper {
                display: flex;
            gap: 4px;
                }

            .quick-tags {
                display: flex;
                flex-wrap: wrap;
                margin-top: 8px;
            }

            .quick-tags .tag {
                background: rgba(255,255,255,0.1);
                color: rgba(255,255,255,0.8);
                padding: 4px 12px;
                border-radius: var(--radius-full);
                font-size: var(--text-xs);
                font-weight: 500;
            }

            .tag.aventuras { color: #facc15; background: rgba(250, 204, 21, 0.1); }
            .tag.belico { color: #f87171; background: rgba(248, 113, 113, 0.1); }
            .tag.historico { color: #a3e635; background: rgba(163, 230, 53, 0.1); }

            .modal-footer {
                padding: var(--space-4) var(--space-8);
                border-top: 1px solid rgba(255,255,255,0.1);
                display: flex;
                justify-content: space-between;
                align-items: center;
                background: #1a1b1e;
                margin-top: auto;
            }

            .status-select {
                background: rgba(255,255,255,0.1);
                border: none;
                color: #fff;
                padding: 8px 16px;
                border-radius: var(--radius-md);
                font-size: var(--text-sm);
                cursor: pointer;
                appearance: none;
                background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
                background-repeat: no-repeat;
                background-position: right 8px center;
                background-size: 16px;
                padding-right: 32px;
            }
            .status-select:hover {
                background: rgba(255,255,255,0.15);
            }

            .footer-actions {
                display: flex;
                gap: var(--space-2);
            }

            .btn-icon {
                width: 36px;
                height: 36px;
                border-radius: var(--radius-md);
                background: transparent;
                border: none;
                color: rgba(255,255,255,0.6);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s;
            }

            .btn-icon:hover {
                background: rgba(255,255,255,0.1);
                color: #fff;
            }

            .btn-icon.active-fav {
                color: #FFD700;
            }

            .btn-icon.active-edit {
                color: #fff;
                background: var(--color-accent);
            }

            @media (max-width: 768px) {
                    .modal-content {
                        grid-template-columns: 1fr;
                        padding: var(--space-6);
                    }

                    .book-cover-wrapper {
                        width: 160px;
                        margin: 0 auto;
                    }

                    .info-section {
                        text-align: center;
                    }

                    .header-info {
                        align-items: center;
                    }

                    .metadata-grid {
                        text-align: left;
                    }

                    .tags-list {
                        justify-content: center;
                    }
                }

                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                .animate-spin {
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                .selector-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0,0,0,0.95);
                    z-index: 2147483647;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: var(--space-8);
                }

                .selector-container {
                    width: 100%;
                    max-width: 600px;
                    height: 80%;
                    display: flex;
                    flex-direction: column;
                }

                .cover-selector-container {
                    background: #1a1b1e;
                    border-radius: var(--radius-lg);
                    border: 1px solid rgba(255,255,255,0.1);
                    overflow: hidden;
                }

                .cover-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
                    gap: var(--space-4);
                    padding: var(--space-4);
                    overflow-y: auto;
                }

                .cover-option {
                    aspect-ratio: 2/3;
                    border-radius: var(--radius-md);
                    overflow: hidden;
                    cursor: pointer;
                    transition: transform 0.2s;
                    border: 2px solid transparent;
                }

                .cover-option:hover {
                    transform: scale(1.05);
                    border-color: var(--color-accent);
                }

                .cover-option img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                .btn-xs {
                    font-size: 10px;
                    padding: 2px 6px;
                    border-radius: 4px;
                    border: none;
                    background: rgba(255,255,255,0.2);
                    color: white;
                    cursor: pointer;
                    margin-top: 4px;
                }

                .btn-xs:hover {
                    background: rgba(255,255,255,0.3);
                }

                .no-results {
                    grid-column: 1 / -1;
                    text-align: center;
                    color: rgba(255,255,255,0.5);
                    padding: var(--space-8);
                }

                /* Category Section Styles */
                .category-section {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-3);
                    margin-top: var(--space-4);
                }

                .category-section .section-label {
                    display: flex;
                    align-items: center;
                    gap: var(--space-2);
                }

                .category-warning {
                    font-size: var(--text-sm);
                    cursor: help;
                }

                .category-selector {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 6px;
                }

                .category-chip {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    padding: 4px 10px;
                    border-radius: 99px;
                    background: rgba(255,255,255,0.08);
                    border: 1px solid rgba(255,255,255,0.1);
                    color: rgba(255,255,255,0.7);
                    font-size: 11px;
                    cursor: pointer;
                    transition: all 0.15s ease;
                }

                .category-chip:hover {
                    background: rgba(255,255,255,0.12);
                    border-color: rgba(255,255,255,0.2);
                    color: white;
                }

                .category-chip.active {
                    background: linear-gradient(135deg, rgba(99, 102, 241, 0.3), rgba(168, 85, 247, 0.3));
                    border-color: rgba(139, 92, 246, 0.5);
                    color: white;
                    box-shadow: 0 0 12px rgba(139, 92, 246, 0.3);
                }

                .cat-icon {
                    font-size: 12px;
                }

                .cat-label {
                    font-weight: 500;
                }

                /* Rating Section Styles */
                .rating-section {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-3);
                    margin-top: var(--space-4);
                    padding-top: var(--space-4);
                    border-top: 1px solid rgba(255,255,255,0.1);
                }

                .rating-selector {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                }

                .rating-chip {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 6px 12px;
                    border-radius: var(--radius-md);
                    background: rgba(255,255,255,0.06);
                    border: 1px solid rgba(255,255,255,0.08);
                    color: rgba(255,255,255,0.6);
                    font-size: 12px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }

                .rating-chip:hover {
                    background: rgba(255,255,255,0.1);
                    border-color: rgba(255,255,255,0.15);
                    color: rgba(255,255,255,0.9);
                    transform: translateY(-1px);
                }

                .rating-chip.active {
                    border-color: rgba(255,255,255,0.3);
                    color: white;
                }

                /* Rating-specific active states */
                .rating-chip.active[title*="Cambió"] {
                    background: linear-gradient(135deg, rgba(56, 189, 248, 0.25), rgba(99, 102, 241, 0.25));
                    border-color: rgba(56, 189, 248, 0.5);
                    box-shadow: 0 0 16px rgba(56, 189, 248, 0.2);
                }

                .rating-chip.active[title*="Placer"] {
                    background: linear-gradient(135deg, rgba(244, 63, 94, 0.25), rgba(251, 113, 133, 0.25));
                    border-color: rgba(244, 63, 94, 0.5);
                    box-shadow: 0 0 16px rgba(244, 63, 94, 0.2);
                }

                .rating-chip.active[title*="Consulta"] {
                    background: linear-gradient(135deg, rgba(250, 204, 21, 0.25), rgba(251, 191, 36, 0.25));
                    border-color: rgba(250, 204, 21, 0.5);
                    box-shadow: 0 0 16px rgba(250, 204, 21, 0.15);
                }

                .rating-chip.active[title*="múltiples"] {
                    background: linear-gradient(135deg, rgba(168, 85, 247, 0.25), rgba(192, 132, 252, 0.25));
                    border-color: rgba(168, 85, 247, 0.5);
                    box-shadow: 0 0 16px rgba(168, 85, 247, 0.2);
                }

                .rating-chip.active[title*="Decente"] {
                    background: rgba(255,255,255,0.1);
                    border-color: rgba(255,255,255,0.25);
                }

                .rating-chip.active[title*="Sin valor"] {
                    background: rgba(255,255,255,0.05);
                    border-color: rgba(255,255,255,0.15);
                    opacity: 0.7;
                }

                .rating-icon {
                    font-size: 14px;
                }

                .rating-label {
                    font-weight: 500;
                }
      `}</style>
        </div >
    );
}
