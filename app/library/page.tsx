'use client';

import { useEffect, useState } from 'react';
import { useLibraryStore, useAppStore } from '@/stores/appStore';
import { getAllBooks } from '@/lib/db';
import { BookCard } from '@/components/library/BookCard';
import { ImportModal } from '@/components/library/ImportModal';

const SortIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
        <line x1="4" y1="6" x2="16" y2="6" />
        <line x1="4" y1="12" x2="12" y2="12" />
        <line x1="4" y1="18" x2="8" y2="18" />
    </svg>
);

const GridIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
    </svg>
);

const ListIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
        <line x1="8" y1="6" x2="21" y2="6" />
        <line x1="8" y1="12" x2="21" y2="12" />
        <line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3.01" y2="6" />
        <line x1="3" y1="12" x2="3.01" y2="12" />
        <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
);

const PlusIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
);

export default function LibraryPage() {
    const { books, setBooks, isLoading, setIsLoading, searchQuery, setSearchQuery, sortBy, setSortBy, filteredBooks } = useLibraryStore();
    const [showImport, setShowImport] = useState(false);
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
                <div className="page-header">
                    <div className="header-row">
                        <div>
                            <h1 className="page-title">Biblioteca</h1>
                            <p className="page-subtitle">{books.length} libros en tu colección</p>
                        </div>
                        <button className="btn btn-primary" onClick={() => setShowImport(true)}>
                            <PlusIcon />
                            Importar libros
                        </button>
                    </div>
                </div>

                {/* Toolbar */}
                <div className="library-toolbar">
                    <div className="search-container">
                        <input
                            type="text"
                            className="input search-input"
                            placeholder="Buscar en tu biblioteca..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="toolbar-actions">
                        <select
                            className="input sort-select"
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as any)}
                        >
                            <option value="lastRead">Última lectura</option>
                            <option value="title">Título</option>
                            <option value="author">Autor</option>
                            <option value="addedDate">Fecha añadido</option>
                            <option value="progress">Progreso</option>
                        </select>
                        <div className="view-toggle">
                            <button
                                className={`btn btn-icon ${viewMode === 'grid' ? 'active' : ''}`}
                                onClick={() => setViewMode('grid')}
                                title="Vista cuadrícula"
                            >
                                <GridIcon />
                            </button>
                            <button
                                className={`btn btn-icon ${viewMode === 'list' ? 'active' : ''}`}
                                onClick={() => setViewMode('list')}
                                title="Vista lista"
                            >
                                <ListIcon />
                            </button>
                        </div>
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
                            <BookCard key={book.id} book={book} viewMode={viewMode} />
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
                                <h3 className="heading-4">Tu biblioteca está vacía</h3>
                                <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
                                    Importa tus libros EPUB o PDF para comenzar
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

            <style jsx>{`
        .header-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .library-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: var(--space-4);
          margin-bottom: var(--space-6);
        }

        .search-container {
          flex: 1;
          max-width: 400px;
        }

        .search-input {
          padding-left: var(--space-10);
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2386868b' stroke-width='2'%3E%3Ccircle cx='11' cy='11' r='8'/%3E%3Cline x1='21' y1='21' x2='16.65' y2='16.65'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: var(--space-3) center;
          background-size: 18px;
        }

        .toolbar-actions {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }

        .sort-select {
          width: auto;
          padding-right: var(--space-8);
        }

        .view-toggle {
          display: flex;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          overflow: hidden;
        }

        .view-toggle .btn-icon {
          border-radius: 0;
          border: none;
          background: transparent;
        }

        .view-toggle .btn-icon.active {
          background: var(--color-accent-subtle);
          color: var(--color-accent);
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
          padding: var(--space-16);
          text-align: center;
        }

        .empty-icon {
          color: var(--color-text-tertiary);
          margin-bottom: var(--space-4);
        }

        @media (max-width: 768px) {
          .library-toolbar {
            flex-direction: column;
            align-items: stretch;
          }

          .search-container {
            max-width: none;
          }

          .toolbar-actions {
            justify-content: space-between;
          }
        }
      `}</style>
        </>
    );
}
