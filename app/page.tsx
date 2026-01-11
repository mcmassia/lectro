'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLibraryStore, useAppStore } from '@/stores/appStore';
import { getAllBooks } from '@/lib/db';
import { OnboardingModal } from '@/components/library/OnboardingModal';
import { BookCard } from '@/components/library/BookCard';
import { ActivityRings } from '@/components/dashboard/ActivityRings';

export default function HomePage() {
  const { books, setBooks, isLoading, setIsLoading } = useLibraryStore();
  const { onboardingComplete } = useAppStore();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    // Check if onboarding is needed
    if (!onboardingComplete) {
      setShowOnboarding(true);
    }

    // Load books from database
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

  const inProgressBooks = books.filter(b => b.progress > 0 && b.progress < 100);

  return (
    <>
      <div className="page-container animate-fade-in">
        {/* Hero Section */}
        <section className="dashboard-hero">
          <div className="hero-content">
            <h1 className="heading-1">Bienvenido a <span className="gradient-text">Lectro</span></h1>
            <p className="body-large" style={{ color: 'var(--color-text-secondary)', marginTop: 'var(--space-4)' }}>
              Tu biblioteca personal con inteligencia artificial
            </p>
          </div>
          <div className="hero-stats">
            <ActivityRings />
          </div>
        </section>

        {/* Continue Reading */}
        {recentBooks.length > 0 && (
          <section className="dashboard-section animate-slide-up">
            <div className="section-header">
              <h2 className="heading-3">Continuar leyendo</h2>
              <Link href="/library" className="btn btn-ghost">
                Ver todo
              </Link>
            </div>
            <div className="book-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
              {recentBooks.map((book) => (
                <BookCard key={book.id} book={book} />
              ))}
            </div>
          </section>
        )}

        {/* Empty State */}
        {books.length === 0 && !isLoading && (
          <section className="empty-state animate-slide-up">
            <div className="empty-state-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="80" height="80">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                <line x1="12" y1="6" x2="12" y2="14" />
                <line x1="8" y1="10" x2="16" y2="10" />
              </svg>
            </div>
            <h3 className="heading-3" style={{ marginTop: 'var(--space-4)' }}>
              Tu biblioteca está vacía
            </h3>
            <p className="body-large" style={{ color: 'var(--color-text-secondary)', marginTop: 'var(--space-2)', maxWidth: '400px', textAlign: 'center' }}>
              Importa tus libros EPUB o PDF para comenzar tu viaje de lectura
            </p>
            <Link href="/library" className="btn btn-primary btn-lg" style={{ marginTop: 'var(--space-6)' }}>
              Ir a la biblioteca
            </Link>
          </section>
        )}

        {/* Quick Stats */}
        <section className="dashboard-section animate-slide-up" style={{ animationDelay: '100ms' }}>
          <h2 className="heading-3" style={{ marginBottom: 'var(--space-6)' }}>Resumen</h2>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{books.length}</div>
              <div className="stat-label">Libros en biblioteca</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{inProgressBooks.length}</div>
              <div className="stat-label">En progreso</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{books.filter(b => b.progress === 100).length}</div>
              <div className="stat-label">Completados</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">
                {books.reduce((sum, b) => sum + (b.totalPages || 0), 0).toLocaleString()}
              </div>
              <div className="stat-label">Páginas totales</div>
            </div>
          </div>
        </section>
      </div>

      {showOnboarding && (
        <OnboardingModal onComplete={() => setShowOnboarding(false)} />
      )}

      <style jsx>{`
        .dashboard-hero {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--space-12) 0;
          margin-bottom: var(--space-8);
        }

        .gradient-text {
          background: var(--gradient-accent);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .dashboard-section {
          margin-bottom: var(--space-12);
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--space-6);
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: var(--space-4);
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: var(--space-16);
          text-align: center;
        }

        .empty-state-icon {
          color: var(--color-text-tertiary);
        }

        @media (max-width: 768px) {
          .dashboard-hero {
            flex-direction: column;
            text-align: center;
            gap: var(--space-8);
          }

          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>
    </>
  );
}
