'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/stores/appStore';
import { getCompletedBooksForYear, getReadingGoals, Book } from '@/lib/db';
import { Check } from 'lucide-react';

export function BooksThisYear() {
  const { currentUser } = useAppStore();
  const router = useRouter();
  const [completedBooks, setCompletedBooks] = useState<{ book: Book; completedAt: Date }[]>([]);
  const [yearlyGoal, setYearlyGoal] = useState(12);
  const currentYear = new Date().getFullYear();

  const handleBookClick = (book: Book) => {
    // Navigate to dedicated book details page
    router.push(`/book/${book.id}`);
  };

  useEffect(() => {
    async function loadData() {
      if (!currentUser) return;

      const [books, goals] = await Promise.all([
        getCompletedBooksForYear(currentUser.id, currentYear),
        getReadingGoals(currentUser.id),
      ]);

      setCompletedBooks(books);
      setYearlyGoal(goals.yearlyBooksGoal);
    }

    loadData();
  }, [currentUser, currentYear]);

  const booksLeft = Math.max(0, yearlyGoal - completedBooks.length);

  // Create display slots (completed + remaining placeholders)
  const displaySlots = [...completedBooks];
  const placeholdersNeeded = Math.min(3, booksLeft); // Show max 3 placeholders

  return (
    <div className="books-this-year">
      <h2 className="section-title">Libros leídos en {currentYear}</h2>

      <div className="books-grid">
        {displaySlots.map(({ book }, index) => (
          <div
            key={book.id}
            className="book-slot completed clickable"
            onClick={() => handleBookClick(book)}
            title={book.title}
          >
            {book.cover ? (
              <img src={book.cover} alt={book.title} className="book-cover" />
            ) : (
              <div className="book-cover-placeholder">
                <span>{book.title.charAt(0)}</span>
              </div>
            )}
            <div className="check-badge">
              <Check size={12} strokeWidth={3} />
            </div>
          </div>
        ))}

        {/* Placeholder slots */}
        {Array.from({ length: placeholdersNeeded }).map((_, index) => (
          <div key={`placeholder-${index}`} className="book-slot placeholder">
            <span className="slot-number">{completedBooks.length + index + 1}</span>
          </div>
        ))}
      </div>

      <p className="progress-text">
        {booksLeft > 0 ? (
          <>
            <strong>{booksLeft} {booksLeft === 1 ? 'libro más' : 'libros más'}</strong> para alcanzar tu meta
          </>
        ) : (
          <>
            <strong>¡Meta cumplida!</strong> Has leído {completedBooks.length} libros
          </>
        )}
      </p>

      <style jsx>{`
        .books-this-year {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-5);
        }

        .section-title {
          font-size: var(--text-lg);
          font-weight: 600;
          color: var(--color-text-primary);
        }

        .books-grid {
          display: flex;
          gap: var(--space-3);
          justify-content: center;
          flex-wrap: wrap;
        }

        .book-slot {
          width: 80px;
          height: 120px;
          border-radius: var(--radius-md);
          position: relative;
          overflow: hidden;
          transition: transform 0.2s;
        }

        .book-slot.clickable {
          cursor: pointer;
        }

        .book-slot.clickable:hover {
          transform: scale(1.08);
          box-shadow: var(--shadow-lg);
        }

        .book-slot.completed {
          box-shadow: var(--shadow-md);
        }

        .book-slot.placeholder {
          background: var(--color-bg-tertiary);
          border: 2px dashed var(--color-border);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .book-cover {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .book-cover-placeholder {
          width: 100%;
          height: 100%;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          font-weight: 700;
          color: white;
        }

        .check-badge {
          position: absolute;
          bottom: 6px;
          right: 6px;
          width: 22px;
          height: 22px;
          background: #10b981;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }

        .slot-number {
          font-size: 24px;
          font-weight: 600;
          color: var(--color-text-tertiary);
        }

        .progress-text {
          font-size: var(--text-sm);
          color: var(--color-text-secondary);
          text-align: center;
        }

        .progress-text strong {
          color: var(--color-text-primary);
        }
      `}</style>
    </div>
  );
}
