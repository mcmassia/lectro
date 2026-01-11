'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLibraryStore, useAppStore } from '@/stores/appStore';
import { getAllBooks, Book } from '@/lib/db';
import { BookCard } from '@/components/library/BookCard';
import { ImportModal } from '@/components/library/ImportModal';
import { BookDetailsModal } from '@/components/library/BookDetailsModal';

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
        filteredBooks
    } = useLibraryStore();
    const [showImport, setShowImport] = useState(false);
    const [selectedBook, setSelectedBook] = useState<Book | null>(null);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

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

    const displayBooks = filteredBooks();

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
                        <h1 className="header-title">Biblioteca</h1>
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
                    <div className={viewMode === 'grid' ? 'book-grid' : 'book-list'}>
                        {displayBooks.map((book) => (
                            <BookCard
                                key={book.id}
                                book={book}
                                viewMode={viewMode}
                                onClick={setSelectedBook}
                            />
                        ))}
                    </div>
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
