'use client';

import { useRouter } from 'next/navigation';
import { useReaderStore, useAppStore } from '@/stores/appStore';
import { Book } from '@/lib/db';

interface ReaderToolbarProps {
  book: Book;
}

const ChevronLeftIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const SidebarIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <line x1="9" y1="3" x2="9" y2="21" />
  </svg>
);

const SettingsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

export function ReaderToolbar({ book }: ReaderToolbarProps) {
  const router = useRouter();
  const { currentPage, totalPages, chapterTitle } = useReaderStore();
  const { readerSidebarOpen, setReaderSidebarOpen, setReaderSidebarTab } = useAppStore();

  const progress = totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0;

  return (
    <div className="reader-toolbar glass">
      <div className="toolbar-left">
        <button
          className="btn btn-ghost btn-icon"
          onClick={() => router.push('/')}
          title="Volver al inicio"
        >
          <ChevronLeftIcon />
        </button>
        <div className="book-info">
          <h1 className="book-title">{book.title}</h1>
          <span className="book-chapter">{chapterTitle || book.author}</span>
        </div>
      </div>

      <div className="toolbar-center">
        <div className="progress-info">
          <span className="page-info">{currentPage} / {totalPages}</span>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="progress-percent">{progress}%</span>
        </div>
      </div>

      <div className="toolbar-right">
        <button
          className="btn btn-ghost btn-icon"
          onClick={() => {
            setReaderSidebarTab('settings');
            setReaderSidebarOpen(true);
          }}
          title="Ajustes de lectura"
        >
          <SettingsIcon />
        </button>
        <button
          className={`btn btn-ghost btn-icon ${readerSidebarOpen ? 'active' : ''}`}
          onClick={() => setReaderSidebarOpen(!readerSidebarOpen)}
          title={readerSidebarOpen ? 'Ocultar panel' : 'Mostrar panel'}
        >
          <SidebarIcon />
        </button>
      </div>

      <style jsx>{`
        .reader-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-3) var(--space-6);
          border-bottom: 1px solid var(--color-border);
          z-index: 10;
        }

        .toolbar-left,
        .toolbar-right {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          flex: 1;
        }

        .toolbar-right {
          justify-content: flex-end;
        }

        .toolbar-center {
          flex: 2;
          display: flex;
          justify-content: center;
        }

        .book-info {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .book-title {
          font-size: var(--text-sm);
          font-weight: 600;
          color: var(--color-text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 200px;
        }

        .book-chapter {
          font-size: var(--text-xs);
          color: var(--color-text-tertiary);
        }

        .progress-info {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }

        .page-info {
          font-size: var(--text-sm);
          color: var(--color-text-secondary);
          min-width: 60px;
          text-align: right;
        }

        .progress-bar {
          width: 200px;
          height: 4px;
          background: var(--color-bg-tertiary);
          border-radius: var(--radius-full);
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: var(--gradient-accent);
          transition: width var(--transition-fast);
        }

        .progress-percent {
          font-size: var(--text-sm);
          color: var(--color-text-secondary);
          min-width: 40px;
        }

        .btn-icon.active {
          background: var(--color-accent-subtle);
          color: var(--color-accent);
        }

        @media (max-width: 768px) {
          .toolbar-center {
            display: none;
          }

          .book-title {
            max-width: 150px;
          }
        }
      `}</style>
    </div>
  );
}
