'use client';

import { useLibraryStore, useAppStore } from '@/stores/appStore';
import { getReadingStats } from '@/lib/db';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ActivityRings } from '@/components/dashboard/ActivityRings';

export function RightSidebar() {
    const { books, activeCategory, setActiveCategory } = useLibraryStore();
    const { dailyReadingGoal } = useAppStore();
    const pathname = usePathname();
    const router = useRouter();
    const [stats, setStats] = useState<{ dailyStats: any } | null>(null);

    useEffect(() => {
        getReadingStats().then(setStats);
    }, []);

    const currentlyReading = books.filter(b => b.progress > 0 && b.progress < 100).slice(0, 3);
    const readingStates = {
        unread: books.filter(b => b.progress === 0 && !b.lastReadAt).length,
        toRead: books.filter(b => b.status === 'planToRead').length,
        reading: currentlyReading.length,
    };

    const handleNavigation = (category: 'all' | 'authors') => {
        setActiveCategory(category);
        if (pathname !== '/') {
            router.push('/');
        }
    };

    return (
        <aside className="right-sidebar">
            {/* Quick Filters */}
            <div className="sidebar-section">
                <div className="filter-grid">
                    <button
                        className={`filter-card cyan ${pathname === '/' && activeCategory === 'all' ? 'active' : ''}`}
                        onClick={() => handleNavigation('all')}
                    >
                        <div className="filter-icon">
                            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z" /></svg>
                        </div>
                        <div className="filter-info">
                            <span className="filter-label">Libros</span>
                            <span className="filter-count">{books.length}</span>
                        </div>
                    </button>

                    <button
                        className={`filter-card orange ${pathname === '/' && activeCategory === 'authors' ? 'active' : ''}`}
                        onClick={() => handleNavigation('authors')}
                    >
                        <div className="filter-icon">
                            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                            </svg>
                        </div>
                        <div className="filter-info">
                            <span className="filter-label">Autores</span>
                            <span className="filter-count">
                                {new Set(books.map(b => b.author)).size}
                            </span>
                        </div>
                    </button>

                    <div className="filter-card-wrapper" onClick={() => router.push('/insights')}>
                        <div className={`filter-card red ${pathname === '/insights' ? 'active' : ''}`}>
                            <div className="filter-icon">
                                <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
                            </div>
                            <div className="filter-info">
                                <span className="filter-label">Insights</span>
                                <span className="filter-count">{books.filter(b => b.status === 'favorite').length}</span>
                            </div>
                        </div>
                    </div>

                    <div className="filter-card-wrapper" onClick={() => router.push('/settings')}>
                        <div className={`filter-card purple ${pathname === '/settings' ? 'active' : ''}`}>
                            <div className="filter-icon">
                                <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
                            </div>
                            <div className="filter-info">
                                <span className="filter-label">Ajustes</span>
                            </div>
                        </div>
                    </div>

                    <Link href="/stats" className="filter-card-wrapper full-width">
                        <div className={`filter-card green full-width ${pathname === '/stats' ? 'active' : ''}`}>
                            <div className="filter-icon">
                                <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z" /></svg>
                            </div>
                            <div className="filter-info">
                                <span className="filter-label">Estadísticas</span>
                            </div>
                        </div>
                    </Link>
                </div>
            </div>

            {/* Reading Stats - Compact */}
            <div className="sidebar-section">
                <div className="stats-mini-card">
                    <ActivityRings size="sm" />
                    <div className="stats-info">
                        <span className="stats-value">{stats?.dailyStats?.pagesRead || 0}</span>
                        <span className="stats-label">meta diaria</span>
                    </div>
                </div>
            </div>

            {/* Reading States - List */}
            <div className="sidebar-section">
                <h3 className="section-title">Reading states</h3>
                <div className="reading-states-list">
                    <div className="state-item">
                        <span className="state-dot" />
                        <span className="state-label">Unread</span>
                        <span className="state-count">{readingStates.unread}</span>
                    </div>
                    <div className="state-item">
                        <span className="state-icon">📚</span>
                        <span className="state-label">To read</span>
                        <span className="state-count">{readingStates.toRead}</span>
                    </div>
                    <div className="state-item">
                        <span className="state-icon">👓</span>
                        <span className="state-label">Reading</span>
                        <span className="state-count">{readingStates.reading}</span>
                    </div>
                </div>
            </div>

            <style jsx>{`
        .right-sidebar {
            width: 280px;
            flex-shrink: 0;
            display: flex;
            flex-direction: column;
            gap: var(--space-6);
            border-right: 1px solid var(--color-divider);
            padding-right: var(--space-6);
            padding-left: var(--space-6);
            padding-top: var(--space-6);
            background: var(--color-bg-secondary);
        }
        
        .sidebar-section {
            display: flex;
            flex-direction: column;
            gap: var(--space-2);
        }
        
        .filter-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
        }

        .filter-card-wrapper {
            text-decoration: none !important;
            display: block;
            cursor: pointer;
        }

        .filter-card-wrapper.full-width {
            grid-column: span 2;
        }
        
        .filter-card {
            border: none;
            border-radius: 12px;
            padding: 12px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            height: 80px;
            color: white;
            cursor: pointer;
            transition: transform 0.2s;
            text-align: left;
            position: relative;
            overflow: hidden;
            text-decoration: none !important;
            width: 100%;
            box-sizing: border-box;
        }
        
        .filter-card:hover {
            transform: scale(1.02);
            text-decoration: none !important;
        }
        .filter-card.active {
             box-shadow: 0 0 0 3px rgba(255,255,255,0.3);
        }
        .filter-card.full-width {
            grid-column: span 2;
            height: 60px;
            flex-direction: row;
            align-items: center;
            justify-content: flex-start;
            gap: 12px;
        }
        
        .filter-card.cyan { background-color: #2db6bf !important; }
        .filter-card.orange { background-color: #ff9500 !important; }
        .filter-card.red { background-color: #ea1e34 !important; }
        .filter-card.purple { background-color: #af52de !important; }
        .filter-card.green { background-color: #34c759 !important; }
        .filter-card.blue { background-color: #007aff !important; }
        
        .filter-icon {
            opacity: 0.9;
        }
        .filter-info {
           display: flex;
           justify-content: space-between;
           align-items: flex-end;
           width: 100%;
        }
        .filter-label {
            font-weight: 600;
            font-size: 13px;
        }
        .filter-count {
            font-weight: 700;
            font-size: 18px;
        }
        
        .stats-mini-card {
            background: var(--color-bg-primary);
            padding: 12px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            gap: 12px;
            border: 1px solid var(--color-divider);
        }
        
        .stats-info {
            display: flex;
            flex-direction: column;
        }
        
        .stats-value {
            font-weight: 700;
            font-size: 18px;
            color: var(--color-text-primary);
        }
        
        .stats-label {
            font-size: 11px;
            color: var(--color-text-secondary);
        }
        
        .section-title {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--color-text-tertiary);
            margin-bottom: 4px;
            font-weight: 600;
        }

        .reading-states-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .state-item {
            display: flex;
            align-items: center;
            font-size: 13px;
            color: var(--color-text-secondary);
            padding: 4px 0;
        }
        .state-dot { width: 8px; height: 8px; border-radius: 50%; border: 1px solid currentColor; margin-right: 8px; }
        .state-icon { margin-right: 6px; }
        .state-count { margin-left: auto; font-variant-numeric: tabular-nums; opacity: 0.7; }
        
        @media (max-width: 1024px) {
            .right-sidebar {
                width: 100%;
                border-right: none;
                border-bottom: 1px solid var(--color-divider);
                padding: var(--space-6);
            }
        }
      `}</style>
        </aside>
    );
}
