'use client';

import { useEffect, useState } from 'react';
import { useLibraryStore, useAppStore } from '@/stores/appStore';
import { getAllBooks, Book, deleteBook, syncTagsFromBooks, getAllTags, updateBook } from '@/lib/db';
import { BookCard } from '@/components/library/BookCard';
import { ContinueReadingPanel } from '@/components/home/ContinueReadingPanel';
import { ImportModal } from '@/components/library/ImportModal';
import { BookDetailsModal } from '@/components/library/BookDetailsModal';
import { MassTagManagerModal } from '@/components/library/MassTagManagerModal';
import { syncWithServer } from '@/lib/fileSystem';
import { SyncReportModal } from '@/components/library/SyncReportModal';
import TagManagerView from '@/components/library/TagManagerView';
import { AuthorsView } from '@/components/library/AuthorsView';
import { ArrowDownNarrowWide, ArrowUpNarrowWide } from 'lucide-react';

// ... icons
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

const CheckSquareIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
    <polyline points="9 11 12 14 22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
);

import { useRouter } from 'next/navigation';

// ... (previous imports)

export default function Home() {
  const {
    books, isLoading, isFullyLoaded, setBooks, setIsLoading,
    sortBy, setSortBy, activeCategory, setActiveCategory,
    activeFormat, sortOrder, setSortOrder, currentView, setView,
    syncMetadata, loadRecentBooks, loadBooks, searchQuery,
    activeThematicCategory, activeUserRating, setActiveThematicCategory, setActiveUserRating, xrayKeywords,
    setSelectedBookId
  } = useLibraryStore();
  const { onboardingComplete, currentUser } = useAppStore();
  const router = useRouter();

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showImport, setShowImport] = useState(false);
  const [showSyncReport, setShowSyncReport] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResults, setSyncResults] = useState<{ added: number; removed: number; errors: string[] } | null>(null);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [filteredBooks, setFilteredBooks] = useState<Book[]>([]);

  // Selection Mode State
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedBookIds, setSelectedBookIds] = useState<Set<string>>(new Set());
  const [showMassTagsModal, setShowMassTagsModal] = useState(false);
  const [isGrouped, setIsGrouped] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);

  const [syncLogs, setSyncLogs] = useState<string[]>([]);

  // Sync specific selection to global store for Sidebar X-Ray
  useEffect(() => {
    if (selectedBookIds.size === 1) {
      const id = Array.from(selectedBookIds)[0];
      setSelectedBookId(id);
    } else {
      setSelectedBookId(null);
    }
  }, [selectedBookIds, setSelectedBookId]);

  // Handlers
  const handleSync = async () => {
    setIsSyncing(true);
    setSyncLogs([]);
    setShowSyncReport(true);
    const addLog = (msg: string) => setSyncLogs(prev => [...prev.slice(-19), msg]);

    try {
      const results = await syncWithServer(addLog);
      setSyncResults(results);
      if (activeCategory === 'recientes') await loadRecentBooks();
      else await loadBooks();
    } catch (error) {
      console.error(error);
      setSyncResults({ added: 0, removed: 0, errors: [(error as Error).message] });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteBook = async (book: Book) => {
    try {
      await deleteBook(book.id);
      if (activeCategory === 'recientes' && !isFullyLoaded) await loadRecentBooks();
      else await loadBooks();
    } catch (error) {
      alert('Error al eliminar');
    }
  };

  const handleToggleSelection = (book: Book) => {
    const newSelected = new Set(selectedBookIds);
    if (newSelected.has(book.id)) newSelected.delete(book.id);
    else newSelected.add(book.id);
    setSelectedBookIds(newSelected);
  };

  const handleMassDelete = async () => {
    if (!confirm(`¿Eliminar ${selectedBookIds.size} libros?`)) return;
    try {
      await Promise.all(Array.from(selectedBookIds).map(id => deleteBook(id)));
      if (activeCategory === 'recientes' && !isFullyLoaded) await loadRecentBooks();
      else await loadBooks();
      setSelectedBookIds(new Set());
      setIsSelectionMode(false);
    } catch (e) { alert('Error mass delete'); }
  };

  const handleSelectAll = () => {
    if (selectedBookIds.size === filteredBooks.length) {
      setSelectedBookIds(new Set());
    } else {
      setSelectedBookIds(new Set(filteredBooks.map(b => b.id)));
    }
  };

  const handleMassStatusChange = async (newStatus: Book['status']) => {
    if (selectedBookIds.size === 0) return;
    try {
      await Promise.all(
        Array.from(selectedBookIds).map(id => updateBook(id, { status: newStatus }))
      );
      if (activeCategory === 'recientes' && !isFullyLoaded) await loadRecentBooks();
      else await loadBooks();
      setShowStatusDropdown(false);
    } catch (e) {
      console.error('Error updating status:', e);
      alert('Error al cambiar estado');
    }
  };

  // Auto-clear filters when searching to avoid "no results" due to hidden filters
  useEffect(() => {
    if (searchQuery) {
      if (activeThematicCategory) setActiveThematicCategory(null);
      if (activeUserRating) setActiveUserRating(null);
      if (activeCategory !== 'all') setActiveCategory('all');
    }
  }, [searchQuery, activeThematicCategory, activeUserRating, activeCategory, setActiveThematicCategory, setActiveUserRating, setActiveCategory]);

  useEffect(() => {
    let booksToFilter = books;
    if (activeFormat !== 'all') booksToFilter = booksToFilter.filter(book => book.format === activeFormat);

    // Thematic Category filtering
    if (activeThematicCategory) {
      booksToFilter = booksToFilter.filter(book => book.metadata?.categories?.includes(activeThematicCategory));
    }

    // User Rating filtering
    if (activeUserRating) {
      booksToFilter = booksToFilter.filter(book => book.metadata?.userRating === activeUserRating);
    }

    // Category filtering (Tabs)
    if (activeCategory === 'favorites') booksToFilter = booksToFilter.filter(book => book.isFavorite || book.metadata?.userRating === 'favorito');
    else if (activeCategory === 'planToRead') booksToFilter = booksToFilter.filter(book => book.status === 'planToRead');
    else if (activeCategory === 'interesting') booksToFilter = booksToFilter.filter(book => book.status === 'interesting');
    else if (activeCategory === 'completed') booksToFilter = booksToFilter.filter(book => book.status === 'completed');
    else if (activeCategory === 'unread') booksToFilter = booksToFilter.filter(book => !book.status || book.status === 'unread');
    else if (activeCategory === 'reading') booksToFilter = booksToFilter.filter(book => book.status === 'reading');
    else if (activeCategory === 're_read') booksToFilter = booksToFilter.filter(book => book.status === 're_read');
    else if (activeCategory === 'recientes') {
      booksToFilter = [...booksToFilter].sort((a, b) => (new Date(b.updatedAt || b.addedAt || 0).getTime() - new Date(a.updatedAt || a.addedAt || 0).getTime()));
      booksToFilter = booksToFilter.slice(0, 12);
    }
    else if (activeCategory === 'no-metadata') {
      booksToFilter = booksToFilter.filter(book =>
        !book.author || book.author === 'Unknown Author' ||
        !book.metadata?.description || book.metadata.description.length < 10
      );
    }
    else if (activeCategory === 'no-cover') {
      booksToFilter = booksToFilter.filter(book => !book.cover);
    }

    if (searchQuery) {
      const terms = searchQuery.toLowerCase().split(/\s+/).filter(t => t.length > 0);
      booksToFilter = booksToFilter.filter(book => {
        const searchableText = [
          book.title,
          book.author,
          ...(book.metadata?.categories || []),
          book.metadata?.userRating || '',
          ...(book.metadata?.subjects || []),
          xrayKeywords[book.id] || ''
        ].join(' ').toLowerCase();

        // All terms must be present
        return terms.every(term => searchableText.includes(term));
      });
    }

    // Sort
    booksToFilter.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'title') comparison = a.title.localeCompare(b.title);
      else if (sortBy === 'author') comparison = a.author.localeCompare(b.author);
      else if (sortBy === 'addedDate') comparison = (new Date(a.addedAt || 0).getTime() - new Date(b.addedAt || 0).getTime());
      else if (sortBy === 'progress') comparison = (a.progress || 0) - (b.progress || 0);

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    setFilteredBooks(booksToFilter);
  }, [books, searchQuery, activeCategory, activeFormat, sortBy, sortOrder, activeThematicCategory, activeUserRating]);

  // Auth Check & Init
  useEffect(() => {
    // If no user, redirect to login immediately
    if (!currentUser) {
      router.push('/login');
      return;
    }

    async function init() {
      if (activeCategory === 'recientes') await loadRecentBooks();
      else await loadBooks();

      const currentBooks = useLibraryStore.getState().books;
      if (currentBooks.length > 0) {
        await syncTagsFromBooks(currentBooks);
      }
      const allTags = await getAllTags();
      useLibraryStore.getState().setTags(allTags);

      // Metadata sync might be heavy, maybe defer?
      await syncMetadata();
    }
    init();
  }, [currentUser, activeCategory, router]); // Added dependencies


  const recentBooks = books.filter(b => b.status === 'reading').sort((a, b) => (b.lastReadAt?.getTime() || 0) - (a.lastReadAt?.getTime() || 0)).slice(0, 4);
  const displayBooks = filteredBooks;


  if (currentView === 'tags') return <TagManagerView />;
  if (activeCategory === 'authors') return <AuthorsView />;

  return (
    <>
      <div className="page-container animate-fade-in">
        {/* Continue Reading Panel */}
        {recentBooks.length > 0 && (
          <div className="mb-8">
            <div className="continue-reading-section">
              {/* Pass the list of recent books to the panel, it handles the grid/list itself */}
              <ContinueReadingPanel books={recentBooks} onOpenDetails={setSelectedBook} />
            </div>
          </div>
        )}

        {/* Library Header & Controls */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-primary">Libros ({displayBooks.length})</h2>

            <div className="flex items-center gap-4">
              {/* Text Filter Links - clearly separated */}
              <button
                onClick={() => {
                  setActiveCategory('recientes');
                  loadRecentBooks();
                  setIsGrouped(false);
                }}
                style={{
                  color: activeCategory === 'recientes' ? '#0a84ff' : '#6b7280',
                  fontWeight: activeCategory === 'recientes' ? 700 : 500,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  padding: '4px 8px'
                }}
              >
                Reciente
              </button>



              <span style={{ color: '#4b5563' }}>|</span>

              <button
                onClick={() => {
                  setActiveCategory('all');
                  loadBooks(); // Force load all books
                  setIsGrouped(false);
                  // Reset filters
                  setActiveThematicCategory(null);
                  setActiveUserRating(null);
                }}
                style={{
                  color: activeCategory === 'all' && !isGrouped && !activeThematicCategory && !activeUserRating ? '#0a84ff' : '#6b7280',
                  fontWeight: activeCategory === 'all' && !isGrouped && !activeThematicCategory && !activeUserRating ? 700 : 500,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  padding: '4px 8px'
                }}
              >
                Todos
              </button>

              {/* Separator */}
              <div style={{ width: '1px', height: '20px', backgroundColor: '#4b5563', margin: '0 8px' }}></div>

              {/* Toggle Switch with Label */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
                <span style={{
                  color: isGrouped ? '#0a84ff' : '#6b7280',
                  fontWeight: isGrouped ? 600 : 500,
                  fontSize: '0.875rem'
                }}>
                  Por autor
                </span>
                <div style={{ position: 'relative', width: '44px', height: '24px' }}>
                  <input
                    type="checkbox"
                    checked={isGrouped}
                    onChange={() => {
                      setIsGrouped(!isGrouped);
                      if (!isGrouped) setSortBy('author');
                    }}
                    style={{
                      position: 'absolute',
                      width: '100%',
                      height: '100%',
                      opacity: 0,
                      cursor: 'pointer',
                      zIndex: 1
                    }}
                  />
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: isGrouped ? '#0a84ff' : '#374151',
                    borderRadius: '12px',
                    transition: 'background-color 0.2s'
                  }}></div>
                  <div style={{
                    position: 'absolute',
                    top: '2px',
                    left: isGrouped ? '22px' : '2px',
                    width: '20px',
                    height: '20px',
                    backgroundColor: 'white',
                    borderRadius: '50%',
                    transition: 'left 0.2s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                  }}></div>
                </div>
              </label>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Sort & View Controls */}
            <div className="flex items-center gap-1 bg-secondary p-1 rounded-lg">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent border-none text-sm text-secondary focus:outline-none cursor-pointer py-1 pl-2 pr-1"
              >
                <option value="title">Título</option>
                <option value="author">Autor</option>
                <option value="addedDate">Fecha inclusión</option>
                <option value="progress">% Progreso</option>
                <option value="fileSize">Tamaño archivo</option>
                <option value="lastRead">Último leído</option>
              </select>
              <button onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')} className="p-1 text-secondary hover:text-primary">
                {/* Simple icon */}
                {sortOrder === 'asc' ? <ArrowUpNarrowWide size={16} /> : <ArrowDownNarrowWide size={16} />}
              </button>
            </div>

            <div className="w-px h-6 bg-border mx-2"></div>

            <div className="flex bg-secondary rounded-lg p-0.5">
              <button className={`p-2 rounded-md ${viewMode === 'grid' ? 'bg-elevated text-accent shadow-sm' : 'text-tertiary'}`} onClick={() => setViewMode('grid')}>
                <GridIcon />
              </button>
              <button className={`p-2 rounded-md ${viewMode === 'list' ? 'bg-elevated text-accent shadow-sm' : 'text-tertiary'}`} onClick={() => setViewMode('list')}>
                <ListIcon />
              </button>
            </div>

            <button
              className={`p-2 rounded-lg ml-2 ${isSelectionMode ? 'bg-accent text-white' : 'bg-secondary text-secondary'}`}
              onClick={() => setIsSelectionMode(!isSelectionMode)}
              title="Selección múltiple"
            >
              <CheckSquareIcon />
            </button>

            <button
              className={`p-2 rounded-lg ml-2 bg-secondary text-secondary ${isSyncing ? 'animate-spin' : ''}`}
              onClick={handleSync}
              title="Sincronizar"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Books Grid */}
        {isLoading ? (
          <div className="book-grid">
            {[...Array(8)].map((_, i) => <div key={i} className="book-card skeleton" style={{ aspectRatio: '2/3', background: 'var(--color-bg-tertiary)' }} />)}
          </div>
        ) : displayBooks.length > 0 ? (
          /* Library Content */
          isGrouped ? (
            <div className="grouped-library animate-slide-up">
              {Object.entries(displayBooks.reduce((acc, book) => {
                const author = book.author || 'Sin autor';
                if (!acc[author]) acc[author] = [];
                acc[author].push(book);
                return acc;
              }, {} as Record<string, Book[]>)).sort((a, b) => a[0].localeCompare(b[0])).map(([author, authorBooks]) => (
                <div key={author} className="author-group mb-10">
                  <div className="flex items-center gap-3 mb-4 border-b border-border pb-2">
                    <h3 className="text-xl font-bold text-primary">{author}</h3>
                    <span className="text-sm text-secondary bg-secondary px-2 py-0.5 rounded-full">{authorBooks.length}</span>
                  </div>
                  <div className={viewMode === 'grid' ? 'book-grid' : 'book-list'}>
                    {authorBooks.map(book => (
                      <BookCard
                        key={book.id}
                        book={book}
                        viewMode={viewMode}
                        onClick={(b) => {
                          setSelectedBook(b);
                          setSelectedBookId(b.id);
                        }}
                        selectionMode={isSelectionMode}
                        isSelected={selectedBookIds.has(book.id)}
                        onToggleSelection={handleToggleSelection}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={`${viewMode === 'grid' ? 'book-grid' : 'book-list'} animate-slide-up`}>
              {displayBooks.map(book => (
                <BookCard
                  key={book.id}
                  book={book}
                  viewMode={viewMode}
                  onClick={(b) => {
                    setSelectedBook(b);
                    setSelectedBookId(b.id);
                  }}
                  selectionMode={isSelectionMode}
                  isSelected={selectedBookIds.has(book.id)}
                  onToggleSelection={handleToggleSelection}
                />
              ))}
            </div>
          )
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-secondary mb-4">No se encontraron libros</p>
            <button className="btn btn-primary" onClick={() => setShowImport(true)}>Importar Libros</button>
          </div>
        )}
      </div>

      {/* Modals */}
      <div className={`selection-toolbar ${isSelectionMode || selectedBookIds.size > 0 ? 'visible' : ''}`}>
        <div className="selection-count">
          <span className="count">{selectedBookIds.size}</span>
          <span className="label">seleccionados</span>
        </div>
        <div className="selection-actions">
          <button
            className="btn btn-secondary"
            onClick={handleSelectAll}
          >
            {selectedBookIds.size === filteredBooks.length ? 'Ninguno' : 'Todos'}
          </button>
          <div className="separator" />
          <button className="btn-text" onClick={() => { setSelectedBookIds(new Set()); setIsSelectionMode(false); }}>Cancelar</button>
          <div className="separator" />
          <div className="status-dropdown-container">
            <button
              className="btn btn-secondary"
              disabled={selectedBookIds.size === 0}
              onClick={() => setShowStatusDropdown(!showStatusDropdown)}
            >
              Estado ▾
            </button>
            {showStatusDropdown && (
              <div className="status-dropdown">
                <button onClick={() => handleMassStatusChange('unread')}>📚 No leído</button>
                <button onClick={() => handleMassStatusChange('planToRead')}>📋 Para leer</button>
                <button onClick={() => handleMassStatusChange('reading')}>📖 Leyendo</button>
                <button onClick={() => handleMassStatusChange('completed')}>✅ Leído</button>
                <button onClick={() => handleMassStatusChange('interesting')}>⭐ Interesante</button>
                <button onClick={() => handleMassStatusChange('re_read')}>🔄 Releer</button>
              </div>
            )}
          </div>
          <button className="btn btn-secondary" disabled={selectedBookIds.size === 0} onClick={() => setShowMassTagsModal(true)}>Etiquetas</button>
          <button className="btn btn-danger" disabled={selectedBookIds.size === 0} onClick={handleMassDelete}>Eliminar</button>
        </div>
      </div>

      {showImport && <ImportModal onClose={() => setShowImport(false)} />}
      <SyncReportModal isOpen={showSyncReport} onClose={() => setShowSyncReport(false)} results={syncResults} isLoading={isSyncing} progressLogs={syncLogs} />
      {selectedBook && <BookDetailsModal book={selectedBook} onClose={() => setSelectedBook(null)} />}
      <MassTagManagerModal isOpen={showMassTagsModal} onClose={() => setShowMassTagsModal(false)} selectedBooks={books.filter(b => selectedBookIds.has(b.id))} onSuccess={async () => { if (activeCategory === 'recientes') await loadRecentBooks(); else await loadBooks(); }} />

      <style jsx>{`
         .mb-8 { margin-bottom: 2rem; }
         .mb-6 { margin-bottom: 1.5rem; }
         .mb-4 { margin-bottom: 1rem; }
         .flex { display: flex; }
         .flex-col { flex-direction: column; }
         .items-center { align-items: center; }
         .justify-between { justify-content: space-between; }
         .justify-center { justify-content: center; }
         .gap-4 { gap: 1rem; }
         .gap-2 { gap: 0.5rem; }
         .gap-1 { gap: 0.25rem; }
         .py-20 { padding-top: 5rem; padding-bottom: 5rem; }
         .px-3 { padding-left: 0.75rem; padding-right: 0.75rem; }
         .py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; }
         .p-1 { padding: 0.25rem; }
         .p-2 { padding: 0.5rem; }
         .p-0.5 { padding: 0.125rem; }
         .pl-2 { padding-left: 0.5rem; }
         .pr-1 { padding-right: 0.25rem; }
         .ml-2 { margin-left: 0.5rem; }
         .rounded-full { border-radius: 9999px; }
         .rounded-lg { border-radius: var(--radius-md); }
         .rounded-md { border-radius: var(--radius-sm); }
         .bg-secondary { background-color: var(--color-bg-secondary); }
         .bg-elevated { background-color: var(--color-bg-elevated); }
         .bg-transparent { background-color: transparent; }
         .bg-accent { background-color: var(--color-accent); }
         .text-xs { font-size: 0.75rem; }
         .text-sm { font-size: 0.875rem; }
         .font-medium { font-weight: 500; }
         .text-secondary { color: var(--color-text-secondary); }
         .text-tertiary { color: var(--color-text-tertiary); }
         .text-primary { color: var(--color-text-primary); }
         .text-accent { color: var(--color-accent); }
         .text-white { color: white; }
         .border-none { border: none; }
         .focus\:outline-none:focus { outline: none; }
         .cursor-pointer { cursor: pointer; }
         .hover\:text-primary:hover { color: var(--color-text-primary); }
         .shadow-sm { box-shadow: var(--shadow-sm); }
         .w-px { width: 1px; }
         .h-6 { height: 1.5rem; }
         .bg-border { background-color: var(--color-border); }
         .selection-toolbar {
             position: fixed;
             bottom: 32px;
             left: 50%;
             transform: translateX(-50%) translateY(100px);
             background: rgba(26, 27, 30, 0.95);
             backdrop-filter: blur(10px);
             border: 1px solid rgba(255,255,255,0.1);
             padding: 12px 24px;
             border-radius: 99px;
             display: flex;
             align-items: center;
             gap: 24px;
             box-shadow: 0 10px 25px rgba(0,0,0,0.5);
             transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
             z-index: 100;
             opacity: 0;
             pointer-events: none;
         }
         .selection-toolbar.visible {
             transform: translateX(-50%) translateY(0);
             opacity: 1;
             pointer-events: auto;
         }
         .selection-count { display: flex; align-items: baseline; gap: 6px; }
         .selection-count .count { font-size: 1.25rem; font-weight: 700; color: var(--color-accent); }
         .selection-count .label { font-size: 0.875rem; color: var(--color-text-secondary); }
         .selection-actions { display: flex; align-items: center; gap: 12px; }
         .btn-text { background: none; border: none; color: var(--color-text-secondary); cursor: pointer; }
         .btn-text:hover { color: white; }
         .separator { width: 1px; height: 24px; background: rgba(255,255,255,0.1); margin: 0 4px; }
         .book-list { display: flex; flex-direction: column; gap: var(--space-3); }
         .status-dropdown-container { position: relative; }
         .status-dropdown {
             position: absolute;
             bottom: 100%;
             left: 50%;
             transform: translateX(-50%);
             margin-bottom: 8px;
             background: rgba(26, 27, 30, 0.98);
             border: 1px solid rgba(255,255,255,0.15);
             border-radius: 12px;
             padding: 8px;
             min-width: 160px;
             box-shadow: 0 10px 30px rgba(0,0,0,0.5);
             z-index: 110;
             display: flex;
             flex-direction: column;
             gap: 4px;
         }
         .status-dropdown button {
             background: transparent;
             border: none;
             color: var(--color-text-secondary);
             padding: 10px 12px;
             text-align: left;
             border-radius: 8px;
             cursor: pointer;
             font-size: 0.875rem;
             transition: all 0.15s ease;
             display: flex;
             align-items: center;
             gap: 8px;
         }
         .status-dropdown button:hover {
             background: rgba(255,255,255,0.1);
             color: white;
         }
       `}</style>
    </>
  );
}
