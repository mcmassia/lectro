'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLibraryStore, useAppStore } from '@/stores/appStore';
import { getAllBooks, Book } from '@/lib/db';
import { BookCard } from '@/components/library/BookCard';
import { ImportModal } from '@/components/library/ImportModal';
import { BookDetailsModal } from '@/components/library/BookDetailsModal';
import { XRayView } from '@/components/library/XRayView';
import { db } from '@/lib/db';
const SortIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
        <path d="M11 5h10M11 9h10M11 13h10M5 5l-3 3 3 3" />
    </svg>
);

const GridIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
);

const ListIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
        <line x1="8" y1="6" x2="21" y2="6" />
        <line x1="8" y1="12" x2="21" y2="12" />
        <line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3.01" y2="6" />
        <line x1="3" y1="12" x2="3.01" y2="12" />
        <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
);

const PlusIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="24" height="24">
        <path d="M12 5v14M5 12h14" />
    </svg>
);

export default function LibraryPage() {
    const {
        books,
        setBooks,
        isLoading,
        setIsLoading,
        searchQuery,
        setSearchQuery,
        sortBy,
        setSortBy,
        activeCategory,
        setActiveCategory,
        activeThematicCategory,
        setActiveThematicCategory,
        activeUserRating,
        setActiveUserRating,
        filteredBooks,
        setSelectedBookId,
        selectedBookId,
        currentView,
        setView
    } = useLibraryStore();
    const [showImport, setShowImport] = useState(false);
    const [selectedBook, setSelectedBook] = useState<Book | null>(null);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    // Selection Mode State
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedBookIds, setSelectedBookIds] = useState<Set<string>>(new Set());

    // Pagination / Virtualization State
    const [visibleCount, setVisibleCount] = useState(50);
    const LOAD_INCREMENT = 50;

    useEffect(() => {
        async function loadBooks() {
            try {
                const allBooks = await getAllBooks();
                setBooks(allBooks);
            } catch (error) {
                console.error('Failed to load books:', error);
            } finally {
                setIsLoading(false);
            }
        }

        loadBooks();
    }, [setBooks, setIsLoading]);

    // Reset visible count when filters change
    useEffect(() => {
        setVisibleCount(LOAD_INCREMENT);
    }, [searchQuery, activeCategory, activeThematicCategory, activeUserRating, sortBy]);

    // Sync specific selection to global store for Sidebar X-Ray
    useEffect(() => {
        if (selectedBookIds.size === 1) {
            const id = Array.from(selectedBookIds)[0];
            setSelectedBookId(id);
        } else {
            setSelectedBookId(null);
        }
    }, [selectedBookIds, setSelectedBookId]);

    const handleToggleSelection = (book: Book) => {
        const newSelected = new Set(selectedBookIds);
        if (newSelected.has(book.id)) {
            newSelected.delete(book.id);
        } else {
            newSelected.add(book.id);
        }
        setSelectedBookIds(newSelected);
    };

    const allFilteredBooks = filteredBooks();
    const displayBooks = allFilteredBooks.slice(0, visibleCount);
    const hasMore = visibleCount < allFilteredBooks.length;

    // Intersection Observer for Infinite Scroll
    useEffect(() => {
        if (!hasMore) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    setVisibleCount((prev) => prev + LOAD_INCREMENT);
                }
            },
            { threshold: 0.1, rootMargin: '200px' }
        );

        const sentinel = document.getElementById('scroll-sentinel');
        if (sentinel) observer.observe(sentinel);

        return () => observer.disconnect();
    }, [hasMore, visibleCount]);


    // X-Ray View Data Loading
    const [xrayDataForView, setXrayDataForView] = useState<any>(null);

    useEffect(() => {
        console.log('LibraryPage: Effect triggered', { currentView, selectedBookId });
        if (currentView === 'xray' && selectedBookId) {
            console.log('LibraryPage: Fetching X-Ray data for', selectedBookId);
            // Load X-Ray data for selected book
            db.xrayData.where('bookId').equals(selectedBookId).first()
                .then(data => {
                    console.log('LibraryPage: Data fetched', !!data);
                    setXrayDataForView(data);
                })
                .catch(err => console.error('LibraryPage: Fetch Error', err));

            // Also ensure we have the selected book object
            if (!selectedBook) {
                const book = books.find(b => b.id === selectedBookId);
                if (book) setSelectedBook(book);
            }
        }
    }, [currentView, selectedBookId, books, selectedBook]);

    if (currentView === 'xray') {
        if (!selectedBookId) {
            return (
                <div className="page-container flex items-center justify-center h-full">
                    <p>No book selected for X-Ray view</p>
                    <button className="btn btn-primary mt-4" onClick={() => setView('library')}>Back to Library</button>
                </div>
            );
        }

        if (!xrayDataForView || !selectedBook) {
            return (
                <div className="page-container flex flex-col items-center justify-center h-screen">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mb-4"></div>
                    <p className="text-gray-500">Cargando análisis...</p>
                    <button className="btn btn-ghost mt-4 text-sm" onClick={() => setView('library')}>Cancelar</button>
                </div>
            );
        }

        return (
            <div className="page-container" style={{ maxWidth: '100% !important', padding: 0 }}>
                <XRayView
                    data={xrayDataForView}
                    book={selectedBook}
                    onBack={() => setView('library')}
                />
            </div>
        );
    }

    return (
        <>
            <div className="page-container animate-fade-in">
                {/* Header */}
                <div className="library-header">
                    <div className="header-top">
                        <Link href="/" className="back-button">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                                <path d="M15 18l-6-6 6-6" />
                            </svg>
                        </Link>
                        <h1 className="header-title">Biblioteca <span style={{ opacity: 0.5, fontSize: '0.6em', marginLeft: '10px' }}>({allFilteredBooks.length})</span></h1>

                        {/* Selection Mode Toggle in Header if desired, or keep in toolbar */}
                        {selectedBookIds.size > 0 && (
                            <div className="selection-actions">
                                <span className="selection-count">{selectedBookIds.size} seleccionados</span>
                                <button className="btn btn-sm btn-ghost" onClick={() => setSelectedBookIds(new Set())}>
                                    Cancelar
                                </button>
                            </div>
                        )}

                        <button className="btn btn-icon btn-ghost">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                                <circle cx="12" cy="12" r="1" />
                                <circle cx="19" cy="12" r="1" />
                                <circle cx="5" cy="12" r="1" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Header & Toolbar merged */}
                <div className="library-toolbar-combined">
                    <div className="toolbar-section-left">
                        <div className="category-tabs">
                            <button
                                className={`category-tab ${activeCategory === 'all' ? 'active' : ''}`}
                                onClick={() => setActiveCategory('all')}
                            >
                                Todo
                            </button>
                            <button
                                className={`category-tab ${activeCategory === 'favorites' ? 'active' : ''}`}
                                onClick={() => setActiveCategory('favorites')}
                            >
                                Favoritos
                            </button>
                            <button
                                className={`category-tab ${activeCategory === 'planToRead' ? 'active' : ''}`}
                                onClick={() => setActiveCategory('planToRead')}
                            >
                                Por leer
                            </button>
                            <button
                                className={`category-tab ${activeCategory === 'completed' ? 'active' : ''}`}
                                onClick={() => setActiveCategory('completed')}
                            >
                                Completados
                            </button>
                        </div>
                    </div>

                    <div className="toolbar-section-right">
                        {/* Filter: Category */}
                        <div className="sort-container">
                            <button className="btn btn-secondary sort-btn" style={{ minWidth: 'auto', color: activeThematicCategory ? 'var(--color-accent)' : 'inherit' }}>
                                <span className="sort-label">
                                    {activeThematicCategory ? (
                                        <>
                                            <span style={{ opacity: 0.7 }}>Tema:</span> {activeThematicCategory}
                                        </>
                                    ) : 'Tema'}
                                </span>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                                    <path d="M6 9l6 6 6-6" />
                                </svg>
                            </button>
                            <select
                                className="sort-select-absolute"
                                value={activeThematicCategory || ''}
                                onChange={(e) => setActiveThematicCategory(e.target.value as any || null)}
                            >
                                <option value="">Todos los Temas</option>
                                <option value="Narrativa">📖 Narrativa</option>
                                <option value="Pensamiento">🧠 Pensamiento</option>
                                <option value="Espiritualidad">✨ Espiritualidad</option>
                                <option value="Sociedad">🌍 Sociedad</option>
                                <option value="Ciencia">🔬 Ciencia</option>
                                <option value="Tecnología">💻 Tecnología</option>
                                <option value="PoesíaDrama">🎭 Poesía/Drama</option>
                                <option value="ArteCultura">🎨 Arte/Cultura</option>
                                <option value="Crecimiento">🌱 Crecimiento</option>
                                <option value="Práctica">🔧 Práctica</option>
                            </select>
                        </div>

                        {/* Filter: Rating */}
                        <div className="sort-container">
                            <button className="btn btn-secondary sort-btn" style={{ minWidth: 'auto', color: activeUserRating ? 'var(--color-accent)' : 'inherit' }}>
                                <span className="sort-label">
                                    {activeUserRating ? (
                                        <>
                                            <span style={{ opacity: 0.7 }}>Valor:</span> {activeUserRating.charAt(0).toUpperCase() + activeUserRating.slice(1)}
                                        </>
                                    ) : 'Valor'}
                                </span>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                                    <path d="M6 9l6 6 6-6" />
                                </svg>
                            </button>
                            <select
                                className="sort-select-absolute"
                                value={activeUserRating || ''}
                                onChange={(e) => setActiveUserRating(e.target.value as any || null)}
                            >
                                <option value="">Cualquier Valoración</option>
                                <option value="esencial">💎 Esencial</option>
                                <option value="excelente">🌟 Excelente</option>
                                <option value="bueno">👍 Bueno</option>
                                <option value="interesante">🤔 Interesante</option>
                                <option value="regular">😐 Regular</option>
                                <option value="favorito">❤️ Favorito</option>
                            </select>
                        </div>

                        <div className="sort-container">
                            <button className="btn btn-secondary sort-btn" onClick={() => {/* Toggle dropdown */ }}>
                                <span className="sort-label">Ordenar</span>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                                    <path d="M6 9l6 6 6-6" />
                                </svg>
                            </button>
                            <select
                                className="sort-select-absolute"
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as any)}
                            >
                                <option value="relevance">Relevancia</option>
                                <option value="addedDate">Fecha</option>
                                <option value="lastRead">Última lectura</option>
                                <option value="author">Autor</option>
                                <option value="title">Título</option>
                                <option value="progress">Progreso</option>
                                <option value="fileSize">Tamaño</option>
                            </select>
                        </div>

                        <div className="search-container">
                            <input
                                type="text"
                                className="input search-input"
                                placeholder="Buscar..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        <div className="view-toggle">
                            <button
                                className={`btn btn-icon ${viewMode === 'grid' ? 'active' : ''}`}
                                onClick={() => setViewMode('grid')}
                                title="Cuadrícula"
                            >
                                <GridIcon />
                            </button>
                            <button
                                className={`btn btn-icon ${viewMode === 'list' ? 'active' : ''}`}
                                onClick={() => setViewMode('list')}
                                title="Lista"
                            >
                                <ListIcon />
                            </button>
                            <button
                                className={`btn btn-icon ${isSelectionMode ? 'active' : ''}`}
                                onClick={() => {
                                    setIsSelectionMode(!isSelectionMode);
                                    if (isSelectionMode) setSelectedBookIds(new Set()); // Clear on exit
                                }}
                                title={isSelectionMode ? "Salir de selección" : "Seleccionar"}
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                                    <path d="M9 11l3 3L22 4" />
                                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                                </svg>
                            </button>
                        </div>

                        <button className="btn btn-primary btn-import" onClick={() => setShowImport(true)} title="Importar libros">
                            <PlusIcon />
                        </button>
                    </div>
                </div>

                {/* Book Grid */}
                {isLoading ? (
                    <div className="book-grid">
                        {[...Array(8)].map((_, i) => (
                            <div key={i} className="book-card skeleton" />
                        ))}
                    </div>
                ) : displayBooks.length > 0 ? (
                    <>
                        <div className={viewMode === 'grid' ? 'book-grid' : 'book-list'}>
                            {displayBooks.map((book) => (
                                <BookCard
                                    key={book.id}
                                    book={book}
                                    viewMode={viewMode}
                                    selectionMode={isSelectionMode}
                                    isSelected={selectedBookIds.has(book.id)}
                                    onToggleSelection={handleToggleSelection}
                                    onClick={(bk) => {
                                        // If we are in selection mode, Card handles it via onToggleSelection
                                        // But if NOT in selection mode, we select standard way AND set ID for Sidebar
                                        // BUT, maybe user wants sidebar even without modal?
                                        // For now, keep modal behavior + sidebar update
                                        setSelectedBook(bk);
                                        setSelectedBookId(bk.id);
                                    }}
                                />
                            ))}
                        </div>

                        {/* Sentinel for Infinite Scroll */}
                        {hasMore && (
                            <div id="scroll-sentinel" style={{ height: '40px', margin: '20px 0', display: 'flex', justifyContent: 'center', opacity: 0.5 }}>
                                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="empty-library">
                        <div className="empty-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="64" height="64">
                                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                            </svg>
                        </div>
                        {searchQuery ? (
                            <>
                                <h3 className="heading-4">Sin resultados</h3>
                                <p style={{ color: 'var(--color-text-secondary)' }}>
                                    No se encontraron libros que coincidan con &quot;{searchQuery}&quot;
                                </p>
                            </>
                        ) : (
                            <>
                                <h3 className="heading-4">
                                    {activeCategory === 'all' ? 'Tu biblioteca está vacía' : 'No hay libros en esta categoría'}
                                </h3>
                                <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
                                    {activeCategory === 'all' ? 'Importa tus libros EPUB o PDF para comenzar' : 'Añade libros a esta lista para verlos aquí'}
                                </p>
                                <button className="btn btn-primary" onClick={() => setShowImport(true)}>
                                    <PlusIcon />
                                    Importar libros
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>

            {showImport && (
                <ImportModal onClose={() => setShowImport(false)} />
            )}

            {selectedBook && (
                <BookDetailsModal
                    book={selectedBook}
                    onClose={() => setSelectedBook(null)}
                />
            )}

            <style jsx>{`
                .page-container {
                    max-width: 90vw !important;
                }

                .library-header {
                    margin-bottom: var(--space-6);
                }

                .header-top {
                    display: flex;
                    align-items: center;
                    margin-bottom: var(--space-6);
                    gap: var(--space-4);
                }

                .back-button {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    background: var(--color-bg-secondary);
                    color: var(--color-text-primary);
                    border: 1px solid var(--color-border);
                    transition: all var(--transition-fast);
                }
                
                .back-button:hover {
                    background: var(--color-bg-tertiary);
                }

                .header-title {
                    font-size: var(--text-2xl);
                    font-weight: 700;
                    margin: 0;
                    flex: 1;
                    display: flex; /* Allow badge alignment */
                    align-items: center;
                }

                .library-toolbar-combined {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: var(--space-6);
                    gap: var(--space-4);
                    flex-wrap: wrap;
                }

                .toolbar-section-left {
                    display: flex;
                    align-items: center;
                    gap: var(--space-4);
                }

                .toolbar-section-right {
                     display: flex;
                    align-items: center;
                    gap: var(--space-3);
                    flex: 1;
                    justify-content: flex-end;
                }

                .category-tabs {
                    display: flex;
                    gap: var(--space-1);
                    background: var(--color-bg-secondary);
                    padding: 4px;
                    border-radius: var(--radius-lg);
                }

                .category-tab {
                    padding: 6px 16px;
                    border-radius: var(--radius-md);
                    font-size: var(--text-sm);
                    font-weight: 500;
                    color: var(--color-text-secondary);
                    background: transparent;
                    border: none;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .category-tab:hover {
                    color: var(--color-text-primary);
                }

                .category-tab.active {
                    background: var(--color-bg-tertiary);
                    color: var(--color-text-primary);
                    box-shadow: 0 1px 2px rgba(0,0,0,0.1);
                }

                .sort-container {
                    position: relative;
                }
                
                .sort-select-absolute {
                    position: absolute;
                    inset: 0;
                    opacity: 0;
                    cursor: pointer;
                    width: 100%;
                }

                .sort-btn {
                    padding: 0 12px;
                    height: 36px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: var(--text-sm);
                }

                .search-container {
                    position: relative;
                    width: 200px;
                }

                .search-input {
                
                /* Custom styling for search icon since input::before doesn't work on input directly */
                .search-container::after {
                    content: '';
                    position: absolute;
                    left: 12px;
                    top: 50%;
                    transform: translateY(-50%);
                    width: 16px;
                    height: 16px;
                    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2386868b' stroke-width='2'%3E%3Ccircle cx='11' cy='11' r='8'/%3E%3Cline x1='21' y1='21' x2='16.65' y2='16.65'/%3E%3C/svg%3E");
                    background-repeat: no-repeat;
                    pointer-events: none;
                }

                .view-toggle {
                    display: flex;
                    background: var(--color-bg-secondary);
                    border-radius: var(--radius-md);
                    padding: 2px;
                    gap: 2px;
                }

                .view-toggle .btn-icon {
                    width: 32px;
                    height: 32px;
                    border-radius: var(--radius-sm);
                    color: var(--color-text-tertiary);
                }

                .view-toggle .btn-icon.active {
                    background: var(--color-bg-elevated);
                    color: var(--color-accent);
                    box-shadow: var(--shadow-sm);
                }
                
                .btn-import {
                    width: 40px;
                    height: 40px;
                    padding: 0;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .book-list {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-3);
                }

                .empty-library {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: var(--space-20) 0;
                    text-align: center;
                }

                .empty-icon {
                    color: var(--color-text-tertiary);
                    margin-bottom: var(--space-6);
                    opacity: 0.5;
                }
                
                @media (max-width: 768px) {
                    .library-toolbar {
                        flex-direction: column;
                        align-items: stretch;
                        gap: var(--space-4);
                    }
                    
                    .toolbar-right {
                        justify-content: space-between;
                    }
                    
                    .search-container {
                        max-width: none;
                    }
                }
            `}</style>
        </>
    );
}
