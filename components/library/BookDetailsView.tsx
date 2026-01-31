'use client';

import { useState, useRef, useEffect } from 'react';
import { Book, updateBook, getAllTags, Tag, BookCategory, UserBookRating, updateUserBookData } from '@/lib/db';
import { useLibraryStore, useAppStore } from '@/stores/appStore';
import { syncData } from '@/lib/sync';
import { useRouter } from 'next/navigation';
import { searchMetadata, findCovers, MetadataResult } from '@/lib/metadata';
import { MetadataSelector } from './MetadataSelector';
import { generateXRayAction } from '@/app/actions/ai';
import { BrainCircuit, Sparkles, ArrowLeft, MoreVertical, X } from 'lucide-react';
import { db, XRayData } from '@/lib/db';

interface BookDetailsViewProps {
    book: Book;
    onBack: () => void;
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


export function BookDetailsView({ book: initialBook, onBack }: BookDetailsViewProps) {
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
    const { currentUser } = useAppStore();
    const router = useRouter();
    const modalRef = useRef<HTMLDivElement>(null);

    // Focus on mount
    useEffect(() => {
        if (modalRef.current) {
            modalRef.current.focus();
        }
    }, []);

    // X-Ray State
    const [hasXRay, setHasXRay] = useState(false);
    const [isGeneratingXRay, setIsGeneratingXRay] = useState(false);

    useEffect(() => {
        db.xrayData.where('bookId').equals(book.id).count().then(count => setHasXRay(count > 0));
    }, [book.id]);

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
                                setBook(prev => ({ ...prev, cover: base64 }));
                                setIsEditing(true);

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
                    e.preventDefault();
                }
            }
        };

        document.addEventListener('paste', handleGlobalPaste);
        return () => document.removeEventListener('paste', handleGlobalPaste);
    }, [book.id, updateBookInStore]);


    useEffect(() => {
        getAllTags().then(setAvailableTags);
    }, []);

    const handleStatusChange = async (status: Book['status']) => {
        try {
            if (!currentUser) {
                console.error('No current user for status change');
                return;
            }
            await updateUserBookData(currentUser.id, book.id, { status });
            updateBookInStore(book.id, { status });
            setBook({ ...book, status });
            syncData().catch(e => console.error('Sync after status change failed:', e));
        } catch (error) {
            console.error('Failed to update status:', error);
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
            title: result.title || book.title,
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
            updates.cover = result.cover;
        }

        setBook({ ...book, ...updates });
        setIsEditing(true);
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
        setIsEditing(true);
        setShowCoverSelector(false);
    };

    const handleViewXRay = () => {
        useLibraryStore.getState().setView('xray');
        useLibraryStore.getState().setSelectedBookId(book.id);
        // No onClose logic needed, view switch handles it
    };

    const handleGenerateXRay = async () => {
        setIsGeneratingXRay(true);
        try {
            let bookContent: ArrayBuffer;

            if (book.fileBlob) {
                bookContent = await book.fileBlob.arrayBuffer();
            } else if (book.isOnServer && book.filePath) {
                const encodedPath = book.filePath.split('/').map(encodeURIComponent).join('/');
                const response = await fetch(`/api/library/stream/${encodedPath}`);
                if (!response.ok) {
                    throw new Error(`Failed to download book from server: ${response.status}`);
                }
                bookContent = await response.arrayBuffer();
            } else {
                alert("No se pudo obtener el contenido del libro (falta blob local y ruta remota).");
                setIsGeneratingXRay(false);
                return;
            }

            const ePub = (await import('epubjs')).default;
            const bookInstance = ePub(bookContent);
            await bookInstance.ready;

            let fullText = '';
            // @ts-ignore
            const spine = bookInstance.spine;
            const sections: any[] = [];
            spine.each((section: any) => sections.push(section));

            const limit = 60000;
            const JSZip = (await import('jszip')).default;
            const zip = await JSZip.loadAsync(bookContent);

            for (const item of sections) {
                if (fullText.length >= limit) break;

                let text = '';
                const href = item.href;

                try {
                    let zipFile = zip.file(href);
                    if (!zipFile) {
                        const cleanHref = href.replace(/^\//, '');
                        zipFile = zip.file(cleanHref);
                    }
                    if (!zipFile) {
                        const files = Object.keys(zip.files);
                        const match = files.find(f => f.endsWith(href) || href.endsWith(f));
                        if (match) zipFile = zip.file(match);
                    }

                    if (zipFile) {
                        const rawContent = await zipFile.async('string');
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(rawContent, 'text/html');
                        text = (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
                    }
                } catch (e) {
                    console.warn(`X-Ray: Extraction failed for ${href}`, e);
                }

                if (text) {
                    fullText += text + '\n\n';
                }
            }
            bookInstance.destroy();
            const content = fullText;

            if (!content || content.length < 500) {
                alert("No se pudo extraer suficiente texto del libro.");
                setIsGeneratingXRay(false);
                return;
            }

            const result = await generateXRayAction(content, book.title);

            if (result.success && result.data) {
                const newXray: XRayData = {
                    id: crypto.randomUUID(),
                    bookId: book.id,
                    generatedAt: new Date(),
                    language: result.data.language,
                    summary: result.data.summary,
                    plot: result.data.plot,
                    keyPoints: result.data.keyPoints,
                    characters: result.data.characters.map((c: any) => ({ ...c, mentions: [] })),
                    places: result.data.places.map((p: any) => ({ ...p, mentions: [] })),
                    terms: result.data.terms.map((t: any) => ({ ...t, mentions: [] })),
                };
                await db.xrayData.add(newXray);
                setHasXRay(true);
            } else {
                alert("Error generando X-Ray: " + result.error);
            }

        } catch (e) {
            console.error(e);
            alert("Error general al generar ADN");
        } finally {
            setIsGeneratingXRay(false);
        }
    };

    const handleRead = () => {
        router.push(`/reader/${book.id}`);
    };

    const handleDownload = () => {
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
        <div className="book-details-view animate-fade-in" ref={modalRef} tabIndex={-1}>

            {/* Header */}
            <div className="view-header">
                <button className="back-btn" onClick={onBack}>
                    <ArrowLeft size={20} />
                    <span>Volver</span>
                </button>

                <div className="header-actions-group">
                    {/* Status Dropdown */}
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

                    <button
                        className="btn-icon"
                        onClick={handleSearchMetadata}
                        title="Find Metadata"
                        disabled={isSearching}
                    >
                        {isSearching ? (
                            <div className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full"></div>
                        ) : (
                            <Sparkles size={18} />
                        )}
                    </button>

                    {/* Edit/Save toggle button */}
                    <button
                        id="save-metadata-btn"
                        type="button"
                        className={`btn-icon ${isEditing ? 'active-edit' : ''}`}
                        onClick={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();

                            if (isEditing) {
                                try {
                                    const cleanMetadata = {
                                        ...(book.metadata || {}),
                                        description: book.metadata?.description || '',
                                        publisher: book.metadata?.publisher || '',
                                        publishedDate: book.metadata?.publishedDate || '',
                                        language: book.metadata?.language || '',
                                        tags: book.metadata?.tags || [],
                                        categories: book.metadata?.categories || [],
                                    };

                                    const now = new Date();
                                    const updates = {
                                        title: book.title || 'Untitled',
                                        author: book.author || 'Unknown Author',
                                        cover: book.cover,
                                        metadata: cleanMetadata,
                                        updatedAt: now
                                    };

                                    await updateBook(book.id, updates);
                                    updateBookInStore(book.id, updates);
                                    setBook({ ...book, ...updates });
                                    syncData().catch(e => console.error('Sync after metadata save failed:', e));
                                    setIsEditing(false);
                                } catch (err: any) {
                                    console.error('Save failed:', err);
                                    alert('Error al guardar localmente');
                                }
                            } else {
                                setIsEditing(true);
                            }
                        }}
                        title={isEditing ? "Guardar Cambios" : "Editar Metadatos"}
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
                </div>
            </div>

            <div className="view-content">
                <div
                    className="cover-section"
                    title="Paste image (Ctrl+V)"
                >
                    <div className="book-cover-wrapper">
                        <img
                            src={`/api/covers/${book.id}?width=400&v=${new Date(book.updatedAt || 0).getTime()}`}
                            alt={book.title}
                            className="book-cover"
                            onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                if (book.cover && target.src !== book.cover) {
                                    target.src = book.cover;
                                } else {
                                    target.style.display = 'none';
                                    const wrapper = target.parentElement;
                                    if (wrapper && !wrapper.querySelector('.placeholder-fallback')) {
                                        const placeholder = document.createElement('div');
                                        placeholder.className = 'book-cover-placeholder placeholder-fallback';
                                        placeholder.innerHTML = `<span>${book.title[0]}</span>`;
                                        wrapper.appendChild(placeholder);
                                    }
                                }
                            }}
                        />
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
                            Leer
                        </button>
                        {!book.isOnServer && (
                            <button className="btn btn-secondary btn-download" onClick={async () => {
                                try {
                                    if (confirm('¿Subir este libro al servidor?')) {
                                        const { uploadBookToServer } = await import('@/lib/fileSystem');
                                        await uploadBookToServer(book);
                                        alert('Libro subido correctamente al servidor.');
                                        onBack();
                                    }
                                } catch (e) {
                                    alert('Error al subir libro: ' + (e as Error).message);
                                }
                            }}>
                                Subir a Cloud
                            </button>
                        )}
                        <button className="btn btn-secondary btn-download" onClick={handleDownload}>
                            Descargar ({formatFileSize(book.fileSize)})
                        </button>

                        {/* X-Ray / Vision Button */}
                        <button
                            className={`btn ${hasXRay ? 'btn-accent' : 'btn-secondary'} btn-xray`}
                            onClick={hasXRay ? handleViewXRay : handleGenerateXRay}
                            disabled={isGeneratingXRay}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                            {isGeneratingXRay ? (
                                <Sparkles size={18} className="animate-spin" />
                            ) : hasXRay ? (
                                <BrainCircuit size={18} />
                            ) : (
                                <Sparkles size={18} />
                            )}
                            <span>{isGeneratingXRay ? 'Generando...' : hasXRay ? 'Ver ADN' : 'Generar ADN'}</span>
                        </button>
                    </div>

                    <div className="description-section">
                        <h3 className="section-label">Descripción</h3>
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
                            <div
                                className="description-text"
                                dangerouslySetInnerHTML={{ __html: book.metadata?.description || 'No description available.' }}
                            />
                        )}
                    </div>

                    <div className="metadata-grid">
                        <div className="metadata-item">
                            <span className="meta-label">Fecha Pub.</span>
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
                            <span className="meta-label">Idioma</span>
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
                            <span className="meta-label">Formato</span>
                            <span className="meta-value upp">{book.format}</span>
                        </div>
                        <div className="metadata-item">
                            <span className="meta-label">Editorial</span>
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

                    {/* Etiquetas */}
                    <div className="category-section">
                        <h3 className="section-label">
                            Etiquetas
                        </h3>
                        <div className="category-selector">
                            {CATEGORIES.map(cat => {
                                const isActive = book.metadata?.categories?.includes(cat.id) || false;
                                return (
                                    <button
                                        key={cat.id}
                                        className={`category-chip ${isActive ? 'active' : ''}`}
                                        onClick={async () => {
                                            const currentCategories = new Set(book.metadata?.categories || []);
                                            const currentManual = new Set(book.metadata?.manualCategories || []);

                                            if (isActive) {
                                                currentCategories.delete(cat.id);
                                                currentManual.delete(cat.id);
                                            } else {
                                                currentCategories.add(cat.id);
                                                currentManual.add(cat.id);
                                            }

                                            const newMetadata = {
                                                ...book.metadata,
                                                categories: Array.from(currentCategories),
                                                manualCategories: Array.from(currentManual)
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


            {/* Selectors */}
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
                                    <X size={20} />
                                </button>
                            </div>
                            {isSearchingCovers ? (
                                <div className="loading-state">
                                    <div className="animate-spin w-6 h-6 border-2 border-white/30 border-t-white rounded-full"></div>
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
                .book-details-view {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    background: var(--color-bg-primary);
                    color: var(--color-text-primary);
                    overflow: auto;
                    position: relative;
                }

                .view-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 16px 40px;
                    border-bottom: 1px solid var(--color-border);
                    background: var(--color-bg-secondary);
                    position: sticky;
                    top: 0;
                    z-index: 10;
                }

                .back-btn {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    color: var(--color-text-secondary);
                    font-weight: 500;
                    background: none;
                    border: none;
                    cursor: pointer;
                    transition: color 0.2s;
                    font-size: 16px;
                }
                .back-btn:hover { color: var(--color-text-primary); }

                .header-actions-group {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .view-content {
                    max-width: 1200px;
                    margin: 0 auto;
                    width: 100%;
                    padding: 40px;
                    display: grid;
                    grid-template-columns: 300px 1fr;
                    gap: 40px;
                    align-items: start;
                }

                @media (max-width: 900px) {
                    .view-content {
                        grid-template-columns: 1fr;
                        padding: 24px;
                    }
                    .book-cover-wrapper {
                        max-width: 200px;
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
                }

                .book-cover-wrapper {
                     width: 100%;
                    aspect-ratio: 2/3;
                    border-radius: var(--radius-lg);
                    overflow: hidden;
                    box-shadow: 0 10px 40px -10px rgba(0,0,0,0.5);
                    position: relative;
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
                    gap: 24px;
                }

                .header-info {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .author-name {
                    font-size: 18px;
                    color: var(--color-text-secondary);
                    font-weight: 500;
                    margin: 0;
                }

                .book-title {
                    font-size: 36px;
                    font-weight: 700;
                    margin: 0;
                    line-height: 1.1;
                    color: var(--color-text-primary);
                }

                .action-buttons {
                    display: flex;
                    gap: 12px;
                    flex-wrap: wrap;
                }

                .btn {
                    padding: 10px 24px;
                    border-radius: 99px;
                    font-weight: 600;
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
                .btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }

                .btn-secondary {
                    background: var(--color-bg-tertiary);
                    color: var(--color-text-primary);
                    border: 1px solid var(--color-border);
                }
                .btn-secondary:hover { background: var(--color-bg-elevated); transform: translateY(-1px); }

                .btn-accent {
                     background: linear-gradient(135deg, #a855f7, #ec4899);
                     color: white;
                     box-shadow: 0 4px 12px rgba(168, 85, 247, 0.3);
                }
                .btn-accent:hover { transform: translateY(-1px); }


                .metadata-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 24px;
                    padding: 24px 0;
                    border-top: 1px solid var(--color-border);
                    border-bottom: 1px solid var(--color-border);
                }

                .metadata-item {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .meta-label {
                    font-size: 11px;
                    color: var(--color-text-tertiary);
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    font-weight: 600;
                }

                .meta-value {
                    font-size: 14px;
                    color: var(--color-text-primary);
                }
                .upp { text-transform: uppercase; }

                .section-label {
                    font-size: 14px;
                    color: var(--color-text-tertiary);
                    margin-bottom: 12px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    font-weight: 600;
                }
                
                .description-text {
                    font-size: 16px;
                    line-height: 1.7;
                    color: var(--color-text-secondary);
                }

                /* Categories */
                 .category-selector {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                }

                .category-chip {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 6px 12px;
                    border-radius: 99px;
                    background: var(--color-bg-tertiary);
                    border: 1px solid var(--color-border);
                    color: var(--color-text-secondary);
                    font-size: 12px;
                    cursor: pointer;
                    transition: all 0.15s ease;
                }
                .category-chip:hover {
                    background: var(--color-bg-elevated);
                    color: var(--color-text-primary);
                }
                .category-chip.active {
                    background: rgba(168, 85, 247, 0.1);
                    border-color: var(--color-accent);
                    color: var(--color-accent);
                }

                /* Ratings */
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
                    background: var(--color-bg-tertiary);
                    border: 1px solid var(--color-border);
                    color: var(--color-text-secondary);
                    font-size: 12px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                .rating-chip:hover {
                     background: var(--color-bg-elevated);
                     color: var(--color-text-primary);
                }
                .rating-chip.active {
                    background: var(--color-bg-elevated);
                    border-color: var(--color-accent);
                    color: var(--color-text-primary);
                }

                 /* Status Dropdown */
                 .status-select {
                    background: var(--color-bg-tertiary);
                    border: 1px solid var(--color-border);
                    color: var(--color-text-primary);
                    padding: 6px 12px;
                    border-radius: 8px;
                    font-size: 13px;
                    cursor: pointer;
                }

                /* Buttons */
                .btn-icon {
                    width: 32px;
                    height: 32px;
                    border-radius: 8px;
                    background: transparent;
                    border: 1px solid var(--color-border);
                    color: var(--color-text-secondary);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                }
                .btn-icon:hover {
                    background: var(--color-bg-tertiary);
                    color: var(--color-text-primary);
                }
                .btn-icon.active-edit {
                    background: var(--color-accent);
                    color: white;
                    border-color: var(--color-accent);
                }

                .btn-xs {
                    font-size: 10px;
                    padding: 2px 8px;
                    border-radius: 4px;
                    border: none;
                    background: rgba(255,255,255,0.2);
                    color: white;
                    cursor: pointer;
                    margin-top: 8px;
                }

                /* Inputs */
                .edit-input, .edit-textarea, .edit-input-sm {
                    background: var(--color-bg-tertiary);
                    border: 1px solid var(--color-border);
                    color: var(--color-text-primary);
                    padding: 8px;
                    border-radius: 6px;
                    width: 100%;
                }

                /* Selector Overlays */
                .selector-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0,0,0,0.8);
                    z-index: 100;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 40px;
                }
                .selector-container {
                    width: 100%;
                    max-width: 600px;
                    max-height: 80vh;
                    background: var(--color-bg-secondary);
                    border-radius: 12px;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                }
                .selector-header {
                    padding: 16px;
                    border-bottom: 1px solid var(--color-border);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .selector-header h3 { margin: 0; font-size: 16px; }
                 .cover-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
                    gap: 16px;
                    padding: 16px;
                    overflow-y: auto;
                }
                .cover-option {
                    aspect-ratio: 2/3;
                    border-radius: 6px;
                    overflow: hidden;
                    cursor: pointer;
                    border: 2px solid transparent;
                }
                .cover-option:hover { border-color: var(--color-accent); }
                .cover-option img { width: 100%; height: 100%; object-fit: cover; }
                .loading-state, .no-results { padding: 32px; text-align: center; color: var(--color-text-secondary); display: flex; flex-direction: column; align-items: center; gap: 8px; }

                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .animate-fade-in { animation: fadeIn 0.3s ease-out; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

            `}</style>
        </div>
    );
}
