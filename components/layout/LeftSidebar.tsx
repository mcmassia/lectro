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
    Book,
    Star,
    Heart,
    Bookmark,
    AlertCircle,
    ImageOff,
    ShieldAlert,
    Award,
    Repeat,
    ThumbsUp,
    Trash2,
    LogOut,
    Menu,
    PanelLeftClose,
    X
} from 'lucide-react';

export function LeftSidebar() {
    const {
        books,
        activeCategory, setActiveCategory,
        activeFormat, setActiveFormat,
        activeTag, setActiveTag,
        activeUserRating, setActiveUserRating,
        setView,
        setTags
    } = useLibraryStore();

    const { mobileMenuOpen, setMobileMenuOpen } = useAppStore();
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
        if (mobileMenuOpen) setMobileMenuOpen(false);
    };

    const closeMobileMenu = () => {
        if (mobileMenuOpen) setMobileMenuOpen(false);
    };

    if (pathname?.startsWith('/reader')) return null;

    return (
        <>
            {/* Mobile Overlay */}
            {mobileMenuOpen && (
                <div className="mobile-overlay" onClick={() => setMobileMenuOpen(false)} />
            )}

            <aside className={`left-sidebar ${isCollapsed ? 'collapsed' : ''} ${mobileMenuOpen ? 'mobile-open' : ''}`}>
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
                        {!isCollapsed && <h3 className="section-title">Valoraciones</h3>}
                        <button className={`nav-item ${activeUserRating === 'imprescindible' ? 'active-subtle' : ''}`} onClick={() => { setActiveUserRating('imprescindible'); setActiveCategory('all'); closeMobileMenu(); }}>
                            <Award size={18} color="#A855F7" />
                            {!isCollapsed && <span>Imprescindible</span>}
                            {!isCollapsed && <span className="count">{books.filter(b => b.metadata?.userRating === 'imprescindible').length}</span>}
                        </button>
                        <button className={`nav-item ${activeUserRating === 'favorito' ? 'active-subtle' : ''}`} onClick={() => { setActiveUserRating('favorito'); setActiveCategory('all'); closeMobileMenu(); }}>
                            <Heart size={18} color="#EF4444" />
                            {!isCollapsed && <span>Favorito</span>}
                            {!isCollapsed && <span className="count">{books.filter(b => b.metadata?.userRating === 'favorito').length}</span>}
                        </button>
                        <button className={`nav-item ${activeUserRating === 'referencia' ? 'active-subtle' : ''}`} onClick={() => { setActiveUserRating('referencia'); setActiveCategory('all'); closeMobileMenu(); }}>
                            <Star size={18} color="#F59E0B" />
                            {!isCollapsed && <span>Referencia</span>}
                            {!isCollapsed && <span className="count">{books.filter(b => b.metadata?.userRating === 'referencia').length}</span>}
                        </button>
                        <button className={`nav-item ${activeUserRating === 'releer' ? 'active-subtle' : ''}`} onClick={() => { setActiveUserRating('releer'); setActiveCategory('all'); closeMobileMenu(); }}>
                            <Repeat size={18} color="#10B981" />
                            {!isCollapsed && <span>Releer</span>}
                            {!isCollapsed && <span className="count">{books.filter(b => b.metadata?.userRating === 'releer').length}</span>}
                        </button>
                        <button className={`nav-item ${activeUserRating === 'correcto' ? 'active-subtle' : ''}`} onClick={() => { setActiveUserRating('correcto'); setActiveCategory('all'); closeMobileMenu(); }}>
                            <ThumbsUp size={18} color="#3B82F6" />
                            {!isCollapsed && <span>Correcto</span>}
                            {!isCollapsed && <span className="count">{books.filter(b => b.metadata?.userRating === 'correcto').length}</span>}
                        </button>
                        <button className={`nav-item ${activeUserRating === 'prescindible' ? 'active-subtle' : ''}`} onClick={() => { setActiveUserRating('prescindible'); setActiveCategory('all'); closeMobileMenu(); }}>
                            <Trash2 size={18} color="#6B7280" />
                            {!isCollapsed && <span>Prescindible</span>}
                            {!isCollapsed && <span className="count">{books.filter(b => b.metadata?.userRating === 'prescindible').length}</span>}
                        </button>
                    </div>

                    {/* Mantenimiento */}
                    <div className="nav-section">
                        {!isCollapsed && <h3 className="section-title">Mantenimiento</h3>}
                        <button className={`nav-item ${activeCategory === 'no-metadata' ? 'active-subtle' : ''}`} onClick={() => { setActiveCategory('no-metadata' as any); setActiveUserRating(null); closeMobileMenu(); }}>
                            <ShieldAlert size={18} color="#F59E0B" />
                            {!isCollapsed && <span>Sin Metadatos</span>}
                            {!isCollapsed && <span className="count">{books.filter(b => !b.author || b.author === 'Unknown Author' || !b.metadata?.description).length}</span>}
                        </button>
                        <button className={`nav-item ${activeCategory === 'no-cover' ? 'active-subtle' : ''}`} onClick={() => { setActiveCategory('no-cover' as any); setActiveUserRating(null); closeMobileMenu(); }}>
                            <ImageOff size={18} color="#EF4444" />
                            {!isCollapsed && <span>Sin Portada</span>}
                            {!isCollapsed && <span className="count">{books.filter(b => !b.cover).length}</span>}
                        </button>
                    </div>

                    {/* Reading States */}
                    <div className="nav-section">
                        {!isCollapsed && <h3 className="section-title">Estados de Lectura</h3>}

                        {/* No leído */}
                        <button className={`nav-item status-item ${activeCategory === 'unread' ? 'active-subtle' : ''}`} onClick={() => { setActiveCategory('unread' as any); closeMobileMenu(); }}>
                            <span className="status-dot unread"></span>
                            {!isCollapsed && <>
                                <span>No leído</span>
                                <span className="count">{readingStates.unread}</span>
                            </>}
                        </button>

                        {/* Interesante */}
                        <button className={`nav-item status-item ${activeCategory === 'interesting' ? 'active-subtle' : ''}`} onClick={() => { setActiveCategory('interesting'); closeMobileMenu(); }}>
                            <span className="status-dot interesting"></span>
                            {!isCollapsed && <>
                                <span>Interesante</span>
                                <span className="count">{readingStates.interesting}</span>
                            </>}
                        </button>

                        {/* Para leer */}
                        <button className={`nav-item status-item ${activeCategory === 'planToRead' ? 'active-subtle' : ''}`} onClick={() => { setActiveCategory('planToRead'); closeMobileMenu(); }}>
                            <span className="status-dot planToRead"></span>
                            {!isCollapsed && <>
                                <span>Para leer</span>
                                <span className="count">{readingStates.planToRead}</span>
                            </>}
                        </button>

                        {/* Leyendo */}
                        <button className={`nav-item status-item ${activeCategory === 'reading' ? 'active-subtle' : ''}`} onClick={() => { setActiveCategory('reading' as any); closeMobileMenu(); }}>
                            <span className="status-dot reading"></span>
                            {!isCollapsed && <>
                                <span>Leyendo</span>
                                <span className="count">{readingStates.reading}</span>
                            </>}
                        </button>

                        {/* Leído */}
                        <button className={`nav-item status-item ${activeCategory === 'completed' ? 'active-subtle' : ''}`} onClick={() => { setActiveCategory('completed'); closeMobileMenu(); }}>
                            <span className="status-dot completed"></span>
                            {!isCollapsed && <>
                                <span>Leído</span>
                                <span className="count">{readingStates.completed}</span>
                            </>}
                        </button>

                        {/* Releer */}
                        <button className={`nav-item status-item ${activeCategory === 're_read' ? 'active-subtle' : ''}`} onClick={() => { setActiveCategory('re_read'); closeMobileMenu(); }}>
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
                            onClick={() => { setActiveFormat('all'); closeMobileMenu(); }}
                        >
                            <Book size={18} />
                            {!isCollapsed && <span>Todos</span>}
                            {!isCollapsed && <span className="count">{formatCounts.all}</span>}
                        </button>

                        <button
                            className={`nav-item ${activeFormat === 'epub' ? 'active-subtle' : ''}`}
                            onClick={() => { setActiveFormat('epub'); closeMobileMenu(); }}
                        >
                            <BookOpen size={18} />
                            {!isCollapsed && <span>EPUB</span>}
                            {!isCollapsed && <span className="count">{formatCounts.epub}</span>}
                        </button>

                        <button
                            className={`nav-item ${activeFormat === 'pdf' ? 'active-subtle' : ''}`}
                            onClick={() => { setActiveFormat('pdf'); closeMobileMenu(); }}
                        >
                            <FileText size={18} />
                            {!isCollapsed && <span>PDF</span>}
                            {!isCollapsed && <span className="count">{formatCounts.pdf}</span>}
                        </button>
                    </div>
                </div>

                <div className="sidebar-footer">
                    {/* Footer content if any */}
                </div>

                <style jsx>{`
                .mobile-sidebar-header {
                    display: none; /* Hidden by default (Desktop) */
                    align-items: center;
                    justify-content: space-between;
                    padding: 16px 20px;
                    border-bottom: 1px solid var(--color-border);
                    background: var(--color-bg-secondary);
                }

                .left-sidebar {
                    width: var(--sidebar-width);
                    height: 100vh;
                    background: var(--color-bg-secondary);
                    border-right: 1px solid var(--color-border);
                    display: flex;
                    flex-direction: column;
                    position: sticky;
                    top: 0;
                    z-index: 50;
                    transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    overflow-x: hidden;
                }

                .left-sidebar.collapsed {
                    width: var(--sidebar-collapsed-width);
                }

                .sidebar-header {
                    height: var(--header-height);
                    display: flex;
                    align-items: center;
                    padding: 0 20px;
                    border-bottom: 1px solid var(--color-border);
                }
                
                .logo-text {
                    font-weight: 700;
                    letter-spacing: 1px;
                    margin-left: 12px;
                    color: var(--color-text-primary);
                }

                .collapse-btn {
                    width: 28px;
                    height: 28px;
                    border-radius: 6px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--color-text-secondary);
                    background: transparent;
                    border: none;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .collapse-btn:hover {
                    background: var(--color-bg-tertiary);
                    color: var(--color-text-primary);
                }

                .sidebar-content {
                    flex: 1;
                    overflow-y: auto;
                    padding: 16px 0;
                }

                .nav-section {
                    margin-bottom: 24px;
                    padding: 0 12px;
                }

                .nav-item {
                    width: 100%;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 10px 12px;
                    margin-bottom: 4px;
                    border-radius: 8px;
                    color: var(--color-text-secondary);
                    text-decoration: none;
                    background: transparent;
                    border: none;
                    cursor: pointer;
                    transition: all 0.2s;
                    font-size: 14px;
                    font-weight: 500;
                    white-space: nowrap;
                    overflow: hidden;
                }

                .nav-item:hover {
                    background: var(--color-bg-tertiary);
                    color: var(--color-text-primary);
                }

                .nav-item.active {
                    background: var(--color-accent-subtle);
                    color: var(--color-accent);
                }

                .nav-item.active-subtle {
                    background: var(--color-bg-tertiary);
                    color: var(--color-text-primary);
                }

                .nav-text {
                    opacity: 1;
                    transition: opacity 0.2s;
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
                
                .left-sidebar.collapsed .nav-item {
                    justify-content: center;
                    padding: 10px 0;
                }

                @media (max-width: 1024px) {
                    .left-sidebar {
                        position: fixed;
                        z-index: 900; /* Below TopBar (1000) */
                        height: calc(100vh - 64px);
                        top: 64px; /* Below TopBar */
                        left: 0;
                        bottom: 0;
                        width: 100vw; /* Full screen width below header */
                        transform: translateX(-100%);
                        border-right: none;
                        background: var(--color-bg-secondary); /* Ensure opaque background */
                        /* Reset desktop collapse behavior */
                        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    }
                    
                    /* Mobile Open State */
                    .left-sidebar.mobile-open {
                        transform: translateX(0);
                    }

                    /* Disable desktop collapse class effects on mobile */
                    .left-sidebar.collapsed {
                        width: 100vw; 
                        border: none;
                    }
                    
                    .left-sidebar.collapsed .sidebar-content {
                        display: flex;
                        flex-direction: column;
                    }

                    .collapse-btn {
                        display: none; 
                    }

                    .mobile-sidebar-header {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        padding: 16px 20px;
                        border-bottom: 1px solid var(--color-border);
                        background: var(--color-bg-secondary);
                    }
                    
                    .mobile-logo {
                        display: flex;
                        align-items: center;
                    }
                    
                    .logo-text-mobile {
                        font-weight: 700;
                        letter-spacing: 1px;
                        color: var(--color-text-primary);
                    }
                    
                    .mobile-close-btn {
                        background: transparent;
                        border: none;
                        color: var(--color-text-primary);
                        padding: 8px;
                        margin-right: -8px;
                    }
                    
                    /* Hide default desktop header on mobile */
                    .left-sidebar .sidebar-header {
                         display: none;
                    }

                    /* Force text visibility on mobile */
                    .left-sidebar.collapsed .nav-text {
                        display: block !important;
                        opacity: 1 !important;
                        width: auto !important;
                    }

                    .left-sidebar.collapsed .nav-item {
                        justify-content: flex-start !important;
                        padding: 10px 12px !important;
                    }
                }



                .mobile-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.5);
                    z-index: 100;
                    backdrop-filter: blur(2px);
                    animation: fadeIn 0.2s ease-out;
                }
            `}</style>
            </aside>
        </>
    );
}
