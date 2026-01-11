'use client';

import Link from 'next/link';
import { Book } from '@/lib/db';

interface BookCardProps {
    book: Book;
    viewMode?: 'grid' | 'list';
}

export function BookCard({ book, viewMode = 'grid' }: BookCardProps) {
    const progressPercent = Math.round(book.progress);

    if (viewMode === 'list') {
        return (
            <Link href={`/reader/${book.id}`} className="book-list-item">
                <div className="book-list-cover">
                    {book.cover ? (
                        <img src={book.cover} alt={book.title} />
                    ) : (
                        <div className="book-placeholder">
                            <span>{book.title[0]}</span>
                        </div>
                    )}
                </div>
                <div className="book-list-info">
                    <h3 className="book-list-title">{book.title}</h3>
                    <p className="book-list-author">{book.author}</p>
                </div>
                <div className="book-list-meta">
                    <span className="book-format">{book.format.toUpperCase()}</span>
                    {progressPercent > 0 && (
                        <div className="progress-badge">
                            {progressPercent}%
                        </div>
                    )}
                </div>

                <style jsx>{`
          .book-list-item {
            display: flex;
            align-items: center;
            gap: var(--space-4);
            padding: var(--space-3);
            background: var(--color-bg-secondary);
            border: 1px solid var(--color-border);
            border-radius: var(--radius-md);
            text-decoration: none;
            transition: all var(--transition-fast);
          }

          .book-list-item:hover {
            border-color: var(--color-border-strong);
            transform: translateX(4px);
          }

          .book-list-cover {
            width: 48px;
            height: 72px;
            border-radius: var(--radius-sm);
            overflow: hidden;
            flex-shrink: 0;
          }

          .book-list-cover img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }

          .book-placeholder {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: var(--gradient-accent);
            color: white;
            font-weight: 600;
            font-size: var(--text-lg);
          }

          .book-list-info {
            flex: 1;
            min-width: 0;
          }

          .book-list-title {
            font-size: var(--text-base);
            font-weight: 600;
            color: var(--color-text-primary);
            margin-bottom: var(--space-1);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .book-list-author {
            font-size: var(--text-sm);
            color: var(--color-text-secondary);
          }

          .book-list-meta {
            display: flex;
            align-items: center;
            gap: var(--space-3);
          }

          .book-format {
            font-size: var(--text-xs);
            color: var(--color-text-tertiary);
            padding: var(--space-1) var(--space-2);
            background: var(--color-bg-tertiary);
            border-radius: var(--radius-sm);
          }

          .progress-badge {
            font-size: var(--text-sm);
            font-weight: 600;
            color: var(--color-accent);
          }
        `}</style>
            </Link>
        );
    }

    return (
        <Link href={`/reader/${book.id}`} className="book-card">
            {book.cover ? (
                <img src={book.cover} alt={book.title} className="book-card-cover" />
            ) : (
                <div className="book-placeholder-grid">
                    <span className="book-initial">{book.title[0]}</span>
                    <div className="book-placeholder-info">
                        <h4>{book.title}</h4>
                        <p>{book.author}</p>
                    </div>
                </div>
            )}

            <div className="book-card-overlay" />

            <div className="book-card-info">
                <h3 className="book-card-title">{book.title}</h3>
                <p className="book-card-author">{book.author}</p>
            </div>

            {progressPercent > 0 && (
                <div className="book-card-progress">
                    <div
                        className="book-card-progress-bar"
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>
            )}

            <style jsx>{`
        .book-placeholder-grid {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: var(--gradient-cool);
          color: white;
          padding: var(--space-4);
          text-align: center;
        }

        .book-initial {
          font-size: var(--text-4xl);
          font-weight: 700;
          margin-bottom: var(--space-4);
          opacity: 0.8;
        }

        .book-placeholder-info h4 {
          font-size: var(--text-sm);
          font-weight: 600;
          line-height: 1.3;
          margin-bottom: var(--space-1);
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .book-placeholder-info p {
          font-size: var(--text-xs);
          opacity: 0.8;
        }
      `}</style>
        </Link>
    );
}
