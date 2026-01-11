'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useLibraryStore } from '@/stores/appStore';
import { getAllBooks, getAllAnnotations, Annotation, Book } from '@/lib/db';

export default function SearchPage() {
    const [query, setQuery] = useState('');
    const [searchType, setSearchType] = useState<'all' | 'books' | 'annotations'>('all');
    const [books, setBooks] = useState<Book[]>([]);
    const [annotations, setAnnotations] = useState<Annotation[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function loadData() {
            const [allBooks, allAnnotations] = await Promise.all([
                getAllBooks(),
                getAllAnnotations(),
            ]);
            setBooks(allBooks);
            setAnnotations(allAnnotations);
            setIsLoading(false);
        }
        loadData();
    }, []);

    const filteredBooks = books.filter(book => {
        if (!query.trim()) return false;
        const q = query.toLowerCase();
        return book.title.toLowerCase().includes(q) ||
            book.author.toLowerCase().includes(q);
    });

    const filteredAnnotations = annotations.filter(ann => {
        if (!query.trim()) return false;
        const q = query.toLowerCase();
        return ann.text.toLowerCase().includes(q) ||
            ann.note?.toLowerCase().includes(q);
    });

    const showBooks = searchType === 'all' || searchType === 'books';
    const showAnnotations = searchType === 'all' || searchType === 'annotations';

    return (
        <div className="page-container animate-fade-in">
            <div className="page-header">
                <h1 className="page-title">Búsqueda</h1>
                <p className="page-subtitle">Encuentra libros y anotaciones</p>
            </div>

            <div className="search-container">
                <div className="search-input-container">
                    <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                        type="text"
                        className="search-input"
                        placeholder="Buscar en tu biblioteca..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        autoFocus
                    />
                </div>

                <div className="search-filters">
                    {(['all', 'books', 'annotations'] as const).map((type) => (
                        <button
                            key={type}
                            className={`filter-btn ${searchType === type ? 'active' : ''}`}
                            onClick={() => setSearchType(type)}
                        >
                            {type === 'all' ? 'Todo' : type === 'books' ? 'Libros' : 'Anotaciones'}
                        </button>
                    ))}
                </div>
            </div>

            {!query.trim() ? (
                <div className="search-empty">
                    <p>Escribe algo para buscar en tu biblioteca</p>
                </div>
            ) : (
                <div className="search-results">
                    {/* Books Results */}
                    {showBooks && filteredBooks.length > 0 && (
                        <section className="results-section">
                            <h2 className="section-title">
                                Libros ({filteredBooks.length})
                            </h2>
                            <div className="results-list">
                                {filteredBooks.map((book) => (
                                    <Link key={book.id} href={`/reader/${book.id}`} className="result-item book-result">
                                        <div className="result-cover">
                                            {book.cover ? (
                                                <img src={book.cover} alt={book.title} />
                                            ) : (
                                                <div className="cover-placeholder">{book.title[0]}</div>
                                            )}
                                        </div>
                                        <div className="result-info">
                                            <h3>{book.title}</h3>
                                            <p>{book.author}</p>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Annotations Results */}
                    {showAnnotations && filteredAnnotations.length > 0 && (
                        <section className="results-section">
                            <h2 className="section-title">
                                Anotaciones ({filteredAnnotations.length})
                            </h2>
                            <div className="results-list">
                                {filteredAnnotations.map((ann) => {
                                    const book = books.find(b => b.id === ann.bookId);
                                    return (
                                        <Link key={ann.id} href={`/reader/${ann.bookId}`} className="result-item annotation-result">
                                            <div className="annotation-marker" style={{ backgroundColor: getColorValue(ann.color) }} />
                                            <div className="result-info">
                                                <p className="annotation-text">&quot;{ann.text}&quot;</p>
                                                {ann.note && <p className="annotation-note">{ann.note}</p>}
                                                <span className="annotation-source">{book?.title}</span>
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        </section>
                    )}

                    {/* No Results */}
                    {filteredBooks.length === 0 && filteredAnnotations.length === 0 && (
                        <div className="no-results">
                            <p>No se encontraron resultados para &quot;{query}&quot;</p>
                        </div>
                    )}
                </div>
            )}

            <style jsx>{`
        .search-container {
          margin-bottom: var(--space-8);
        }

        .search-input-container {
          position: relative;
          margin-bottom: var(--space-4);
        }

        .search-icon {
          position: absolute;
          left: var(--space-4);
          top: 50%;
          transform: translateY(-50%);
          color: var(--color-text-tertiary);
        }

        .search-input {
          width: 100%;
          padding: var(--space-4) var(--space-4) var(--space-4) var(--space-12);
          font-size: var(--text-lg);
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          color: var(--color-text-primary);
        }

        .search-input:focus {
          outline: none;
          border-color: var(--color-accent);
          box-shadow: 0 0 0 3px var(--color-accent-subtle);
        }

        .search-filters {
          display: flex;
          gap: var(--space-2);
        }

        .filter-btn {
          padding: var(--space-2) var(--space-4);
          font-size: var(--text-sm);
          background: var(--color-bg-tertiary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-full);
          color: var(--color-text-secondary);
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .filter-btn.active {
          background: var(--color-accent-subtle);
          border-color: var(--color-accent);
          color: var(--color-accent);
        }

        .search-empty,
        .no-results {
          text-align: center;
          padding: var(--space-16);
          color: var(--color-text-tertiary);
        }

        .results-section {
          margin-bottom: var(--space-8);
        }

        .section-title {
          font-size: var(--text-sm);
          font-weight: 600;
          color: var(--color-text-secondary);
          margin-bottom: var(--space-4);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .results-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .result-item {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding: var(--space-3);
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          text-decoration: none;
          transition: all var(--transition-fast);
        }

        .result-item:hover {
          border-color: var(--color-border-strong);
          transform: translateX(4px);
        }

        .result-cover {
          width: 40px;
          height: 60px;
          border-radius: var(--radius-sm);
          overflow: hidden;
          flex-shrink: 0;
          background: var(--color-bg-tertiary);
        }

        .result-cover img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .cover-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--gradient-accent);
          color: white;
          font-weight: 600;
        }

        .result-info h3 {
          font-size: var(--text-base);
          font-weight: 500;
          color: var(--color-text-primary);
          margin-bottom: var(--space-1);
        }

        .result-info p {
          font-size: var(--text-sm);
          color: var(--color-text-secondary);
        }

        .annotation-marker {
          width: 4px;
          height: 40px;
          border-radius: var(--radius-full);
          flex-shrink: 0;
        }

        .annotation-text {
          font-style: italic;
        }

        .annotation-note {
          margin-top: var(--space-1);
          font-size: var(--text-xs);
          color: var(--color-text-tertiary);
        }

        .annotation-source {
          font-size: var(--text-xs);
          color: var(--color-accent);
          margin-top: var(--space-2);
        }
      `}</style>
        </div>
    );
}

function getColorValue(color: Annotation['color']): string {
    const colors: Record<Annotation['color'], string> = {
        yellow: '#ffeb3b',
        green: '#4caf50',
        blue: '#2196f3',
        pink: '#e91e63',
        orange: '#ff9800',
    };
    return colors[color] || colors.yellow;
}
