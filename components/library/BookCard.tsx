'use client';

import { Book } from '@/lib/db';

interface BookCardProps {
  book: Book;
  viewMode: 'grid' | 'list';
  onClick: (book: Book) => void;
}

export function BookCard({ book, viewMode, onClick }: BookCardProps) {
  const progressPercent = book.progress || 0;

  if (viewMode === 'list') {
    return (
      <div className="book-list-item" onClick={() => onClick(book)}>
        <div className="book-list-cover">
          {book.cover ? (
            <img src={book.cover} alt={book.title} />
          ) : (
            <div className="book-placeholder-mini">
              {book.title[0]}
            </div>
          )}
        </div>
        <div className="book-list-info">
          <h3 className="book-list-title">{book.title}</h3>
          <p className="book-list-author">{book.author}</p>
        </div>
        <div className="book-list-meta">
          <span className="last-read">
            {book.lastReadAt ? new Date(book.lastReadAt).toLocaleDateString() : 'Sin leer'}
          </span>
          <div className="progress-pill">
            {Math.round(progressPercent)}%
          </div>
        </div>

        <style jsx>{`
          .book-list-item {
            display: flex;
            align-items: center;
            gap: var(--space-4);
            padding: var(--space-3);
            background: var(--color-bg-secondary);
            border-radius: var(--radius-md);
            text-decoration: none;
            color: inherit;
            transition: background-color var(--transition-fast);
            cursor: pointer;
          }

          .book-list-item:hover {
            background: var(--color-bg-tertiary);
          }

          .book-list-cover {
            width: 40px;
            height: 60px;
            border-radius: var(--radius-sm);
            overflow: hidden;
            flex-shrink: 0;
            background: var(--color-bg-tertiary);
          }

          .book-list-cover img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }

          .book-placeholder-mini {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: var(--gradient-cool);
            color: white;
            font-weight: 700;
          }

          .book-list-info {
            flex: 1;
            min-width: 0;
          }

          .book-list-title {
            font-size: var(--text-sm);
            font-weight: 600;
            margin: 0;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .book-list-author {
            font-size: var(--text-xs);
            color: var(--color-text-secondary);
            margin: 0;
          }

          .book-list-meta {
            display: flex;
            align-items: center;
            gap: var(--space-4);
          }

          .last-read {
            font-size: var(--text-xs);
            color: var(--color-text-tertiary);
          }

          .progress-pill {
            background: var(--color-bg-tertiary);
            padding: 2px 8px;
            border-radius: var(--radius-full);
            font-size: var(--text-xs);
            font-weight: 500;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="book-card-container" onClick={() => onClick(book)}>
      <div className="book-card">
        {book.cover ? (
          <img src={book.cover} alt={book.title} className="book-card-cover" />
        ) : (
          <div className="book-placeholder-grid">
            <span className="book-initial">{book.title[0]}</span>
          </div>
        )}

        {progressPercent > 0 && (
          <div className="book-card-progress">
            <div
              className="book-card-progress-bar"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}
      </div>

      <div className="book-card-info">
        <p className="book-card-author">{book.author}</p>
        <h3 className="book-card-title" title={book.title}>{book.title}</h3>
        {book.status === 'favorite' && (
          <div className="status-indicator favorite">
            <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </div>
        )}
      </div>

      <style jsx>{`
                .book-card-container {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-3);
                    text-decoration: none;
                    color: inherit;
                    position: relative;
                    cursor: pointer;
                }

                .book-card {
                    position: relative;
                    aspect-ratio: 2/3;
                    border-radius: var(--radius-md);
                    overflow: hidden;
                    background: var(--color-bg-tertiary);
                    box-shadow: var(--shadow-sm);
                    transition: all var(--transition-fast);
                    border: 2px solid transparent;
                }

                .book-card-container:hover .book-card {
                    transform: translateY(-4px);
                    box-shadow: var(--shadow-md);
                    border-color: var(--color-accent);
                }

                .book-card-cover {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                .book-card-info {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                    position: relative;
                    opacity: 1 !important;
                    transform: none !important;
                    padding: var(--space-2) 0 0 0;
                    color: inherit;
                    background: transparent;
                }

                .book-card-title {
                    font-size: var(--text-base);
                    font-weight: 700;
                    color: var(--color-text-primary);
                    margin: 0;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    line-height: 1.2;
                }

                .book-card-author {
                    font-size: var(--text-xs);
                    color: var(--color-text-secondary);
                    margin: 0;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    opacity: 0.8 !important; /* Keep slight opacity for author but not 0 */
                }

                .book-placeholder-grid {
                    width: 100%;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: var(--gradient-cool);
                    color: white;
                }

                .book-initial {
                    font-size: var(--text-4xl);
                    font-weight: 700;
                    opacity: 0.8;
                }

                .book-card-progress {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    height: 3px;
                    background: rgba(0,0,0,0.3);
                }

                .book-card-progress-bar {
                    height: 100%;
                    background: var(--color-accent);
                }
                
                .status-indicator {
                    position: absolute;
                    right: 0;
                    top: -2px;
                    color: var(--color-warning);
                }
            `}</style>
    </div>
  );
}
