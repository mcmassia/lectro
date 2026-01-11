'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Book, getReadingSessionsForBook } from '@/lib/db';

interface ContinueReadingPanelProps {
  books: Book[];
}

export function ContinueReadingPanel({ books }: ContinueReadingPanelProps) {
  return (
    <section className="dashboard-section animate-slide-up">
      <div className="section-header">
        <h2 className="heading-3">Continuar leyendo</h2>
      </div>
      <div className="continue-reading-grid">
        {books.map((book) => (
          <ContinueReadingCard key={book.id} book={book} />
        ))}
      </div>
      <style jsx>{`
        .dashboard-section {
          margin-bottom: var(--space-8);
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

function ContinueReadingCard({ book }: { book: Book }) {
  const [hoursRead, setHoursRead] = useState(0);

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
    <Link href={`/reader/${book.id}`} className="continue-card">
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

      <style jsx>{`
        .continue-card {
          display: flex;
          gap: var(--space-4);
          padding: var(--space-4);
          background: var(--color-bg-secondary);
          border-radius: var(--radius-lg);
          border: 1px solid var(--color-border);
          text-decoration: none !important;
          color: inherit;
          transition: all var(--transition-fast);
        }
        
        /* Force override any child elements */
        .continue-card * {
            text-decoration: none !important;
        }

        .continue-card:hover {
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
    </Link>
  );
}
