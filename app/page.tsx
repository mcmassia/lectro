'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLibraryStore, useAppStore } from '@/stores/appStore';
import { getAllBooks, Book } from '@/lib/db';
import { OnboardingModal } from '@/components/library/OnboardingModal';
import { BookCard } from '@/components/library/BookCard';
import { ContinueReadingPanel } from '@/components/home/ContinueReadingPanel';
// import { HomeSidebar } from '@/components/home/HomeSidebar';
import { ImportModal } from '@/components/library/ImportModal';
import { BookDetailsModal } from '@/components/library/BookDetailsModal';
import { syncWithServer } from '@/lib/fileSystem';

import { SyncReportModal } from '@/components/library/SyncReportModal';

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

export default function Home() {
  const { books, isLoading, setBooks, setIsLoading, sortBy, setSortBy, activeCategory, setActiveCategory, sortOrder, setSortOrder } = useLibraryStore();
  const { onboardingComplete } = useAppStore();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showSyncReport, setShowSyncReport] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResults, setSyncResults] = useState<{ added: number; removed: number; errors: string[] } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [filteredBooks, setFilteredBooks] = useState<Book[]>([]);

  // Handle Sync
  const handleSync = async () => {
    setIsSyncing(true);
    setShowSyncReport(true);
    try {
      const results = await syncWithServer();
      setSyncResults(results);

      // Refresh library
      const allBooks = await getAllBooks();
      setBooks(allBooks);
    } catch (error) {
      console.error('Sync failed:', error);
      setSyncResults({ added: 0, removed: 0, errors: [(error as Error).message || 'Unknown error'] });
    } finally {
      setIsSyncing(false);
    }
  };

  // Filter books logic...
  useEffect(() => {
    let booksToFilter = books;

    // Category filter
    if (activeCategory === 'favorites') {
      booksToFilter = booksToFilter.filter(book => book.status === 'favorite');
    } else if (activeCategory === 'planToRead') {
      booksToFilter = booksToFilter.filter(book => book.status === 'planToRead');
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      booksToFilter = booksToFilter.filter(book =>
        book.title.toLowerCase().includes(query) ||
        book.author.toLowerCase().includes(query) ||
        (book.metadata.tags && book.metadata.tags.some(tag => tag.toLowerCase().includes(query)))
      );
    }

    // Sort
    booksToFilter.sort((a, b) => {
      if (sortBy === 'title') {
        return sortOrder === 'asc' ? a.title.localeCompare(b.title) : b.title.localeCompare(a.title);
      } else if (sortBy === 'author') {
        return sortOrder === 'asc' ? a.author.localeCompare(b.author) : b.author.localeCompare(a.author);
      } else if (sortBy === 'lastRead') {
        const dateA = a.lastReadAt?.getTime() || 0;
        const dateB = b.lastReadAt?.getTime() || 0;
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      }
      return 0;
    });

    setFilteredBooks(booksToFilter);
  }, [books, searchQuery, activeCategory, sortBy, sortOrder]);

  useEffect(() => {
    if (!onboardingComplete) {
      setShowOnboarding(true);
    }

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
  }, [onboardingComplete, setBooks, setIsLoading]);

  const recentBooks = books
    .filter(b => b.lastReadAt)
    .sort((a, b) => (b.lastReadAt?.getTime() || 0) - (a.lastReadAt?.getTime() || 0))
    .slice(0, 4);

  const displayBooks = filteredBooks;

  return (
    <>
      <div className="page-container animate-fade-in full-width">
        <div className="main-layout">
          <div className="main-content">
            {/* Continue Reading Panel */}
            {activeCategory === 'all' && recentBooks.length > 0 && (
              <ContinueReadingPanel books={recentBooks} />
            )}

            {/* Library Header & Toolbar */}
            <div className="library-toolbar-combined">
              <div className="toolbar-section-left">
                <h2 className="heading-3" style={{ margin: 0 }}>
                  {activeCategory === 'authors' ? 'Autores' : 'Biblioteca'}
                </h2>
                {activeCategory !== 'authors' && (
                  <div className="category-tabs">
                    <button className={`category-tab ${activeCategory === 'all' ? 'active' : ''}`} onClick={() => setActiveCategory('all')}>Todo</button>
                    <button className={`category-tab ${activeCategory === 'favorites' ? 'active' : ''}`} onClick={() => setActiveCategory('favorites')}>Favoritos</button>
                    <button className={`category-tab ${activeCategory === 'planToRead' ? 'active' : ''}`} onClick={() => setActiveCategory('planToRead')}>Por leer</button>
                  </div>
                )}
              </div>

              <div className="toolbar-section-right">
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
                  <button className={`btn btn-icon ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')}><GridIcon /></button>
                  <button className={`btn btn-icon ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}><ListIcon /></button>
                </div>

                <button className="btn btn-secondary btn-icon" onClick={handleSync} title="Sincronizar con servidor">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7" />
                    <line x1="16" y1="3" x2="21" y2="3" />
                    <line x1="21" y1="3" x2="21" y2="8" />
                    <line x1="21" y1="3" x2="10" y2="14" />
                  </svg>
                </button>
                <button className="btn btn-primary btn-import" onClick={() => setShowImport(true)} title="Importar">
                  <PlusIcon />
                </button>
              </div>
            </div>

            {/* Content Area */}
            {isLoading ? (
              <div className="book-grid">
                {[...Array(8)].map((_, i) => <div key={i} className="book-card skeleton" />)}
              </div>
            ) : activeCategory === 'authors' ? (
              <div className="authors-view">
                {Object.entries(
                  books.reduce((acc, book) => {
                    const author = book.author || 'Unknown Author';
                    if (!acc[author]) acc[author] = [];
                    acc[author].push(book);
                    return acc;
                  }, {} as Record<string, Book[]>)
                ).map(([author, authorBooks]) => (
                  <div key={author} className="author-section">
                    <h3 className="heading-4 author-name">{author}</h3>
                    <div className="book-grid">
                      {authorBooks.map(book => (
                        <BookCard key={book.id} book={book} viewMode="grid" onClick={setSelectedBook} />
                      ))}
                    </div>
                  </div>
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
                <p style={{ color: 'var(--color-text-secondary)' }}>No hay libros para mostrar.</p>
                <button className="btn btn-primary" onClick={() => setShowImport(true)} style={{ marginTop: '1rem' }}>
                  Importar libros
                </button>
              </div>
            )}
          </div>

        </div>
      </div>

      {showOnboarding && <OnboardingModal onComplete={() => setShowOnboarding(false)} />}
      {showImport && (
        <ImportModal onClose={() => setShowImport(false)} />
      )}

      <SyncReportModal
        isOpen={showSyncReport}
        onClose={() => setShowSyncReport(false)}
        results={syncResults}
        isLoading={isSyncing}
      />

      {selectedBook && (
        <BookDetailsModal
          book={selectedBook}
          onClose={() => setSelectedBook(null)}
        />
      )}

      <style jsx>{`
        .main-layout {
            display: flex;
            gap: var(--space-8);
            align-items: flex-start;
        }

        .main-content {
            flex: 1;
            min-width: 0;
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
            gap: var(--space-6);
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
            padding: 4px 12px;
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

        .search-container {
            width: 200px;
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
        
        @media (max-width: 1024px) {
            .main-layout {
                flex-direction: column;
            }
            .right-sidebar {
                width: 100%;
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            }
        }
        
        /* .page-container logic now in globals.css */

        .authors-view {

        .authors-view {
            display: flex;
            flex-direction: column;
            gap: var(--space-8);
        }

        .author-section {
            display: flex;
            flex-direction: column;
            gap: var(--space-4);
            margin-bottom: var(--space-8); /* Add significant spacing between authors */
            padding-bottom: var(--space-4);
            border-bottom: 1px dashed var(--color-divider); /* Optional visual separator */
        }
        
        .author-section:last-child {
            border-bottom: none;
        }
        
        .author-name {
            border-bottom: 1px solid var(--color-divider);
            padding-bottom: var(--space-2);
        }
      `}</style>
    </>
  );
}
