'use client';

import { useLibraryStore, useAppStore } from '@/stores/appStore';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getAllTags } from '@/lib/db';
import {
    Library,
    Target,
    NotebookPen,
    Sparkles,
    Folders,
    ChevronLeft,
    ChevronRight,
    BookOpen,
    Clock,
    CheckCircle,
    FileText,
    Book
} from 'lucide-react';

export function LeftSidebar() {
    const {
        books,
        activeCategory, setActiveCategory,
        activeFormat, setActiveFormat,
        activeTag, setActiveTag,
        setView,
        setTags
    } = useLibraryStore();

    const pathname = usePathname();
    const router = useRouter();
    const [isCollapsed, setIsCollapsed] = useState(false);

    useEffect(() => {
        getAllTags().then(setTags);
    }, [setTags]);

    const readingStates = {
        unread: books.filter(b => !b.status || b.status === 'unread').length,
        interesting: books.filter(b => b.status === 'interesting').length,
        planToRead: books.filter(b => b.status === 'planToRead').length,
        reading: books.filter(b => b.status === 'reading').length,
        completed: books.filter(b => b.status === 'completed').length,
        re_read: books.filter(b => b.status === 're_read').length,
    };

    const formatCounts = {
        all: books.length,
        epub: books.filter(b => b.format === 'epub').length,
        pdf: books.filter(b => b.format === 'pdf').length,
    };

    const handleNavigation = (path: string, category?: string) => {
        if (category) {
            setActiveCategory(category as any);
            setView('library');
        }
        if (pathname !== path) {
            router.push(path);
        }
    };

    if (pathname?.startsWith('/reader')) return null;

    return (
        <aside className={`left-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
            {/* ... Toggle Button & Main Navigation ... (keep as is in previous logic, but here we replace the whole block if needed or just specific parts. I will target the readingStates definition and the sections) */}
            {/* Actually, I will replace the component logic parts or use multi_replace for clearer diffs if I can target ranges. 
                But 'readingStates' is defined at top. The generic replacement below replaces specific blocks. 
            */}

            <button
                className="collapse-btn"
                onClick={() => setIsCollapsed(!isCollapsed)}
                title={isCollapsed ? "Expandir" : "Colapsar"}
            >
                {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>

            <div className="sidebar-content">
                {/* Main Navigation */}
                <div className="nav-section">
                    <button
                        className={`nav-item ${pathname === '/' && activeCategory === 'all' ? 'active' : ''}`}
                        onClick={() => handleNavigation('/', 'all')}
                    >
                        <Library size={20} />
                        {!isCollapsed && <span>Biblioteca</span>}
                    </button>

                    <button className="nav-item">
                        <Target size={20} />
                        {!isCollapsed && <span>Metas de Lectura</span>}
                        {!isCollapsed && <span className="badge-coming-soon">Próx</span>}
                    </button>

                    <Link
                        href="/notes"
                        className={`nav-item ${pathname === '/notes' ? 'active' : ''}`}
                    >
                        <NotebookPen size={20} />
                        {!isCollapsed && <span>Notas</span>}
                    </Link>

                    <button
                        className={`nav-item ${pathname === '/insights' ? 'active' : ''}`}
                        onClick={() => router.push('/insights')}
                    >
                        <Sparkles size={20} />
                        {!isCollapsed && <span>Análisis IA</span>}
                    </button>
                </div>

                {/* Colecciones - Simplified for now or kept as is, user didn't complain about this part explicitly but asked for "Estados de lectura". I'll keep Colecciones as placeholders or maybe integrate interesting there? 
                   User said: "pon en Estados de lectura los que tenemos actualmente No leído, Interesante, Para leer, Leyendo, Leído, Releer".
                   So "Interesante" goes to States now? Or remains in Collections?
                   "Interesante" is a status in our DB usually. 
                   Let's put them ALL in "Estados de Lectura" as requested.
                   "Colecciones" can remain for custom lists later or Favoritos.
                */}
                <div className="nav-section">
                    {!isCollapsed && <h3 className="section-title">Colecciones</h3>}
                    <button className={`nav-item ${activeCategory === 'favorites' ? 'active-subtle' : ''}`} onClick={() => setActiveCategory('favorites')}>
                        <Folders size={20} />
                        {!isCollapsed && <span>Favoritos</span>}
                        {!isCollapsed && <span className="count">{books.filter(b => b.isFavorite).length}</span>}
                    </button>
                </div>

                {/* Reading States */}
                <div className="nav-section">
                    {!isCollapsed && <h3 className="section-title">Estados de Lectura</h3>}

                    {/* No leído */}
                    <button className={`nav-item status-item ${activeCategory === 'unread' ? 'active-subtle' : ''}`} onClick={() => setActiveCategory('unread' as any)}>
                        <span className="status-dot unread"></span>
                        {!isCollapsed && <>
                            <span>No leído</span>
                            <span className="count">{readingStates.unread}</span>
                        </>}
                    </button>

                    {/* Interesante */}
                    <button className={`nav-item status-item ${activeCategory === 'interesting' ? 'active-subtle' : ''}`} onClick={() => setActiveCategory('interesting')}>
                        <span className="status-dot interesting"></span>
                        {!isCollapsed && <>
                            <span>Interesante</span>
                            <span className="count">{readingStates.interesting}</span>
                        </>}
                    </button>

                    {/* Para leer */}
                    <button className={`nav-item status-item ${activeCategory === 'planToRead' ? 'active-subtle' : ''}`} onClick={() => setActiveCategory('planToRead')}>
                        <span className="status-dot planToRead"></span>
                        {!isCollapsed && <>
                            <span>Para leer</span>
                            <span className="count">{readingStates.planToRead}</span>
                        </>}
                    </button>

                    {/* Leyendo */}
                    <button className={`nav-item status-item ${activeCategory === 'reading' ? 'active-subtle' : ''}`} onClick={() => setActiveCategory('reading' as any)}>
                        <span className="status-dot reading"></span>
                        {!isCollapsed && <>
                            <span>Leyendo</span>
                            <span className="count">{readingStates.reading}</span>
                        </>}
                    </button>

                    {/* Leído */}
                    <button className={`nav-item status-item ${activeCategory === 'completed' ? 'active-subtle' : ''}`} onClick={() => setActiveCategory('completed')}>
                        <span className="status-dot completed"></span>
                        {!isCollapsed && <>
                            <span>Leído</span>
                            <span className="count">{readingStates.completed}</span>
                        </>}
                    </button>

                    {/* Releer */}
                    <button className={`nav-item status-item ${activeCategory === 're_read' ? 'active-subtle' : ''}`} onClick={() => setActiveCategory('re_read')}>
                        <span className="status-dot re_read"></span>
                        {!isCollapsed && <>
                            <span>Releer</span>
                            <span className="count">{readingStates.re_read}</span>
                        </>}
                    </button>
                </div>

                {/* Formats */}
                <div className="nav-section">
                    {!isCollapsed && <h3 className="section-title">Formatos</h3>}

                    <button
                        className={`nav-item ${activeFormat === 'all' ? 'active-subtle' : ''}`}
                        onClick={() => setActiveFormat('all')}
                    >
                        <Book size={18} />
                        {!isCollapsed && <span>Todos</span>}
                        {!isCollapsed && <span className="count">{formatCounts.all}</span>}
                    </button>

                    <button
                        className={`nav-item ${activeFormat === 'epub' ? 'active-subtle' : ''}`}
                        onClick={() => setActiveFormat('epub')}
                    >
                        <BookOpen size={18} />
                        {!isCollapsed && <span>EPUB</span>}
                        {!isCollapsed && <span className="count">{formatCounts.epub}</span>}
                    </button>

                    <button
                        className={`nav-item ${activeFormat === 'pdf' ? 'active-subtle' : ''}`}
                        onClick={() => setActiveFormat('pdf')}
                    >
                        <FileText size={18} />
                        {!isCollapsed && <span>PDF</span>}
                        {!isCollapsed && <span className="count">{formatCounts.pdf}</span>}
                    </button>
                </div>
            </div>

            <style jsx>{`
                .left-sidebar {
                    width: 260px;
                    border-right: 1px solid var(--color-divider);
                    background: var(--color-bg-secondary);
                    display: flex;
                    flex-direction: column;
                    position: relative;
                    transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    height: calc(100vh - 64px); /* Subtract TopBar height */
                    flex-shrink: 0;
                }

                .left-sidebar.collapsed {
                    width: 72px;
                }

                .sidebar-content {
                    flex: 1;
                    overflow-y: auto;
                    padding: 24px 16px;
                    display: flex;
                    flex-direction: column;
                    gap: 32px;
                }

                .nav-section {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .section-title {
                    font-size: 11px;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    color: var(--color-text-tertiary);
                    margin-bottom: 8px;
                    padding-left: 12px;
                    font-weight: 600;
                    white-space: nowrap;
                    overflow: hidden;
                    opacity: 1;
                    transition: opacity 0.2s;
                }

                .collapsed .section-title {
                    opacity: 0;
                    height: 0;
                    margin: 0;
                }

                .nav-item {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 10px 12px;
                    border-radius: 8px;
                    border: none;
                    background: transparent;
                    color: var(--color-text-secondary);
                    cursor: pointer;
                    transition: all 0.2s;
                    font-size: 14px;
                    font-weight: 500;
                    width: 100%;
                }

                .nav-item:hover {
                    background: var(--color-bg-tertiary);
                    color: var(--color-text-primary);
                }

                .nav-item.active {
                    background: var(--color-accent);
                    color: white;
                }

                .nav-item.active-subtle {
                    background: var(--color-bg-tertiary);
                    color: var(--color-accent);
                }

                .badge-coming-soon {
                    font-size: 10px;
                    background: var(--color-bg-tertiary);
                    padding: 2px 6px;
                    border-radius: 4px;
                    margin-left: auto;
                    color: var(--color-text-tertiary);
                }

                .status-dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                }

                .status-dot.completed { background-color: var(--color-success); }
                .status-dot.reading { background-color: #a855f7; } /* Purple */
                .status-dot.unread { background-color: var(--color-text-tertiary); }
                .status-dot.interesting { background-color: #f59e0b; } /* Amber */
                .status-dot.planToRead { background-color: #3b82f6; } /* Blue */
                .status-dot.re_read { background-color: #ec4899; } /* Pink */

                .count {
                    margin-left: auto;
                    font-size: 12px;
                    color: var(--color-text-tertiary);
                }

                .collapse-btn {
                    position: absolute;
                    top: 12px;
                    right: -12px;
                    width: 24px;
                    height: 24px;
                    background: var(--color-bg-elevated);
                    border: 1px solid var(--color-divider);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    z-index: 10;
                    color: var(--color-text-secondary);
                    box-shadow: var(--shadow-sm);
                    /* Hide by default, show on hover of sidebar could be cleaner, but standard is always visible or hover */
                }
                
                .collapsed .nav-item {
                    justify-content: center;
                    padding: 10px 0;
                }

                @media (max-width: 768px) {
                    .left-sidebar {
                        position: fixed;
                        z-index: 50;
                        height: calc(100vh - 64px);
                        left: 0;
                        bottom: 0;
                        transform: translateX(0);
                    }
                    .left-sidebar.collapsed {
                        width: 0;
                        border: none;
                        overflow: hidden;
                        padding: 0; /* Clear padding when collapsed on mobile */
                    }
                    /* Ensure the collapse button remains visible or moved */
                    .collapse-btn {
                       right: -12px;
                       /* If fully collapsed width is 0, button needs to be outside or manageable */
                       /* Actually, if width is 0, the button inside might be hidden if it is child of sidebar with overflow hidden? */
                       /* It is child of sidebar. If sidebar has width 0 and overflow hidden, button is gone. */
                       /* On mobile, we might want a different toggle mechanism or keep a small strip. */
                       /* Let's keep a small strip on mobile too or handle it differently. */
                    }
                    /* Let's make mobile behavior: sidebar is an overlay. When collapsed, it is hidden (width 0). 
                       But we need a trigger. The trigger can be in TopBar (Menu icon).
                       The TopBar has a Menu icon? Yes, Lucide Menu.
                       We should wire TopBar Menu icon to toggle sidebar.
                       For now, let's just make it collapse to 0 and assume user can't bring it back without a trigger? 
                       Wait, the user requirement is "design totally responsive".
                       I should rely on the collapse button being visible. 
                       If I set width 0, I must ensure the button is visible.
                       Or I keep width 0 but overflow visible?
                    */
                    .left-sidebar.collapsed {
                        width: 0;
                        overflow: visible; 
                    }
                    .left-sidebar.collapsed .sidebar-content {
                        display: none;
                    }
                }
            `}</style>
        </aside>
    );
}
