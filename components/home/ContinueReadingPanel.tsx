'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Book, getReadingSessionsForBook, updateBook } from '@/lib/db';
import { useLibraryStore } from '@/stores/appStore';

interface ContinueReadingPanelProps {
  books: Book[];
  onOpenDetails: (book: Book) => void;
}

export function ContinueReadingPanel({ books, onOpenDetails }: ContinueReadingPanelProps) {
  return (
    <section className="dashboard-section animate-slide-up">
      <div className="section-header">
        <h2 className="heading-3">Continuar leyendo</h2>
      </div>
      <div className="continue-reading-grid">
        {books.map((book) => (
          <ContinueReadingCard key={book.id} book={book} onOpenDetails={onOpenDetails} />
        ))}
      </div>
      <style jsx>{`
        .dashboard-section {
          margin-bottom: var(--space-8);
          background: #f5f5f5; /* Light gray background */
          padding: var(--space-6);
          border-radius: var(--radius-xl);
          border: 1px solid var(--color-border);
        }
        .section-header {
          margin-bottom: var(--space-2); /* Reduced from space-4 */
        }
        .continue-reading-grid {
          display: grid; /* flex is another option if we want them tightly packed start */
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); /* Drastically reduced to ensure tight packing */
          gap: var(--space-4); /* Restore standard gap for cleanliness, but the boxes will be smaller */
        }
      `}</style>
    </section>
  );
}

function ContinueReadingCard({ book, onOpenDetails }: { book: Book; onOpenDetails: (book: Book) => void }) {
  const [hoursRead, setHoursRead] = useState(0);
  const { updateBook: updateBookInStore } = useLibraryStore();

  // Details handler replaces Remove handler
  const handleDetails = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onOpenDetails(book);
  };

  useEffect(() => {
    async function loadStats() {
      try {
        const sessions = await getReadingSessionsForBook(book.id);
        const totalMinutes = sessions.reduce((sum, s) => {
          const duration = (s.endTime.getTime() - s.startTime.getTime()) / 60000;
          return sum + duration;
        }, 0);
        setHoursRead(Math.round(totalMinutes / 60 * 10) / 10);
      } catch (error) {
        console.error('Failed to load reading stats for book', book.id, error);
      }
    }
    loadStats();
  }, [book.id]);

  const progress = book.progress || 0;
  const currentPage = book.currentPage || 1;
  const totalPages = book.totalPages || 100;

  return (
    <div className="continue-card-wrapper">
      <button
        className="details-btn"
        onClick={handleDetails}
        title="Ver detalles"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      </button>

      <Link href={`/reader/${book.id}`} className="continue-card-content">
        <div className="card-cover">
          {book.cover ? (
            <img src={book.cover} alt={book.title} />
          ) : (
            <div className="placeholder-cover">
              {book.title[0]}
            </div>
          )}
        </div>
        <div className="card-content">
          <div className="card-info">
            <h3 className="card-title" title={book.title}>{book.title}</h3>
            <p className="card-author">{book.author}</p>
          </div>

          <div className="card-stats">
            <div className="stat-row">
              <span>Pág {currentPage} / {totalPages}</span>
              <span className="stat-separator">•</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="stat-row-secondary">
              <span>{hoursRead}h leídas</span>
            </div>
          </div>
        </div>
      </Link>

      <style jsx>{`
        .continue-card-wrapper {
          position: relative;
          background: var(--color-bg-secondary);
          border-radius: var(--radius-lg);
          border: 1px solid var(--color-border);
          transition: all var(--transition-fast);
        }

        .continue-card-content {
          display: flex;
          gap: var(--space-4);
          padding: var(--space-4);
          text-decoration: none !important;
          color: inherit;
          width: 100%;
          height: 100%;
        }

        .details-btn {
            position: absolute;
            top: 8px;
            right: 8px;
            width: 28px;
            height: 28px;
            border-radius: 50%;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(4px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            opacity: 1;
            transition: all 0.2s;
            z-index: 20;
            box-shadow: var(--shadow-sm);
        }

        .continue-card-wrapper:hover .details-btn {
            opacity: 1;
        }

        .details-btn:hover {
            background: var(--color-accent);
            border-color: var(--color-accent);
            transform: scale(1.1);
        }
        
        .continue-card-wrapper:hover {
          background: var(--color-bg-tertiary);
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
          border-color: var(--color-accent);
        }

        .card-cover {
          width: 80px;
          height: 120px;
          border-radius: var(--radius-md);
          overflow: hidden;
          flex-shrink: 0;
          background: var(--color-bg-tertiary);
          box-shadow: var(--shadow-sm);
        }

        .card-cover img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .placeholder-cover {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--gradient-cool);
          color: white;
          font-weight: 700;
          font-size: var(--text-2xl);
        }

        .card-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          min-width: 0;
          padding: var(--space-1) 0;
        }

        .card-title {
          font-size: var(--text-base);
          font-weight: 600;
          margin: 0 0 2px 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          text-decoration: none !important;
        }

        .card-author {
          font-size: var(--text-sm);
          color: var(--color-text-secondary);
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          text-decoration: none !important;
        }

        .card-stats {
          display: flex;
          flex-direction: column;
          gap: 2px;
          font-size: var(--text-xs);
          color: var(--color-text-secondary);
          margin-top: auto;
          margin-bottom: var(--space-3);
        }

        .stat-row {
            display: flex;
            align-items: center;
            gap: var(--space-2);
            font-weight: 500;
            color: var(--color-text-primary);
        }
        
        .stat-separator {
            color: var(--color-text-tertiary);
        }

        .stat-row-secondary {
            color: var(--color-text-tertiary);
        }
      `}</style>
    </div>
  );
}
