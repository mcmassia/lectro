import { useState, useEffect } from 'react';
import { useLibraryStore, useAppStore } from '@/stores/appStore';
import { ActivityRings } from '@/components/dashboard/ActivityRings';
import { ChevronRight, ChevronLeft, Zap, Info, Sparkles, User as UserIcon, LogOut, Settings } from 'lucide-react';
import { getAllTags, getUsers, User } from '@/lib/db';
import { usePathname, useRouter } from 'next/navigation';
import { UserManagementModal } from '@/components/settings/UserManagementModal'; // Need to create this

export function RightSidebar() {
    const { books, tags, setTags, setView, setActiveCategory } = useLibraryStore();
    const { currentUser, logout } = useAppStore();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [showUserModal, setShowUserModal] = useState(false);
    const pathname = usePathname();
    const router = useRouter();

    useEffect(() => {
        getAllTags().then(setTags);
    }, [setTags]);

    if (pathname?.startsWith('/reader') || pathname === '/login') return null;

    const uniqueCategories = new Set(books.flatMap(b => b.metadata?.categories || []));

    const stats = {
        books: books.length,
        authors: new Set(books.map(b => b.author)).size,
        tags: uniqueCategories.size
    };

    const handleLogout = () => {
        logout();
        router.push('/login');
    };

    // Mock data for X-Ray
    const xrayTags = ['Misterio', 'Historia', 'Thriller', 'Aprendizaje', 'Filosofía'];

    return (
        <aside className={`right-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
            <button
                className="collapse-btn"
                onClick={() => setIsCollapsed(!isCollapsed)}
                title={isCollapsed ? "Expandir" : "Colapsar"}
            >
                {isCollapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
            </button>

            <div className="sidebar-content">
                {/* User Profile Removed - Moved to TopBar */}

                {/* Insights Section */}
                <div className="sidebar-section">
                    <div className="section-header">
                        <h3 className="heading-4">Insights de Lectura</h3>
                        <Info size={14} className="info-icon" />
                    </div>
                    <div className="section-subheader">Objetivo Semanal</div>

                    {!isCollapsed && (
                        <div className="rings-wrapper">
                            <ActivityRings size="sm" />
                        </div>
                    )}
                </div>

                {/* Stats / "Números" Section */}
                <div className="sidebar-section">
                    <div className="section-header">
                        <h3 className="section-title">Números</h3>
                    </div>

                    {!isCollapsed && (
                        <div className="stats-grid">
                            <button className="stat-card blue clickable" onClick={() => {
                                setView('library');
                                setActiveCategory('all');
                            }}>
                                <span className="stat-value">{stats.books}</span>
                                <span className="stat-label">Libros</span>
                            </button>
                            <button className="stat-card purple clickable" onClick={() => {
                                setView('library');
                                setActiveCategory('authors' as any);
                            }}>
                                <span className="stat-value">{stats.authors}</span>
                                <span className="stat-label">Autores</span>
                            </button>
                            <button className="stat-card green clickable" onClick={() => {
                                setView('tags');
                            }}>
                                <span className="stat-value">{stats.tags}</span>
                                <span className="stat-label">Etiquetas</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Book DNA / X-Ray */}
                <div className="sidebar-section">
                    <div className="section-header">
                        <h3 className="section-title">ADN del Libro</h3>
                        <span className="badge-ai">AI</span>
                    </div>

                    {!isCollapsed && (
                        <div className="xray-tags">
                            {xrayTags.map((tag, i) => (
                                <span key={i} className={`tag-pill ${i % 2 === 0 ? 'blue' : 'purple'}`}>
                                    {tag}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* UserModal removed from here */}

            <style jsx>{`
                .user-profile-compact {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 8px 0;
                }
                .avatar-circle {
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    background: var(--color-accent);
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: bold;
                    font-size: 16px;
                }
                .user-info {
                    display: flex;
                    flex-direction: column;
                }
                .username {
                    font-weight: 600;
                    color: var(--color-text-primary);
                    font-size: 14px;
                }
                .role {
                    font-size: 11px;
                    color: var(--color-text-secondary);
                }
                /* ... previous styles ... */
                .right-sidebar {
                    width: 300px;
                    border-left: 1px solid var(--color-divider);
                    background: var(--color-bg-secondary);
                    display: flex;
                    flex-direction: column;
                    position: relative;
                    transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    height: calc(100vh - 64px);
                    flex-shrink: 0;
                }


                .right-sidebar.collapsed {
                    width: 0;
                    overflow: hidden;
                    border-left: none; /* Hide border when fully collapsed to avoid double border look if adjacent */
                    padding: 0;
                }
                
                /* When collapsed, we might still want the button visible if we want to expand it back? 
                   If width is 0, the button inside might be hidden if overflow hidden. 
                   Better: width 20px or keep generic collapsed width. 
                   The user asked for "Left Sidebar (collapsible)" and "Right Sidebar (collapsible)". 
                   Usually right sidebar collapses to 0 or icon bar. 
                   Let's assume collapsed width 0 but button protrudes or is separate.
                   Actually, let's keep a small strip or make the button floating relative to the main content.
                   For simplicity, I'll keep a small strip of 20px or modify the button position.
                */
               .right-sidebar.collapsed {
                    width: 24px;
                    border-left: 1px solid var(--color-divider);
               }
               
               .right-sidebar.collapsed .sidebar-content {
                   display: none;
               }

                .sidebar-content {
                    flex: 1;
                    overflow-y: auto;
                    padding: 24px;
                    display: flex;
                    flex-direction: column;
                    gap: 32px;
                }

                .sidebar-section {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .section-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }

                .heading-4 {
                    font-size: 16px;
                    font-weight: 600;
                    color: var(--color-text-primary);
                }

                .section-subheader {
                    font-size: 13px;
                    color: var(--color-text-secondary);
                }
                
                .section-title {
                    font-size: 13px;
                    font-weight: 600;
                    color: var(--color-text-secondary);
                }

                .info-icon {
                    color: var(--color-text-tertiary);
                    cursor: help;
                }
                
                .badge-ai {
                    font-size: 10px;
                    font-weight: 700;
                    color: white;
                    background: linear-gradient(135deg, #a855f7, #ec4899);
                    padding: 2px 6px;
                    border-radius: 4px;
                }

                .rings-wrapper {
                    display: flex;
                    justify-content: center;
                    padding: 12px 0;
                }

                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 8px;
                }

                .stat-card {
                    background: var(--color-bg-tertiary);
                    border-radius: 12px;
                    padding: 12px 8px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 4px;
                }
                
                .stat-card.blue .stat-value { color: #3b82f6; }
                .stat-card.purple .stat-value { color: #a855f7; }
                .stat-card.green .stat-value { color: #10b981; }

                .stat-card.clickable {
                    cursor: pointer;
                    transition: transform 0.2s, background-color 0.2s;
                    border: none;
                }

                .stat-card.clickable:hover {
                    transform: translateY(-2px);
                    background: var(--color-bg-elevated);
                }

                .stat-value {
                    font-size: 18px;
                    font-weight: 700;
                }

                .stat-label {
                    font-size: 10px;
                    color: var(--color-text-secondary);
                    text-transform: lowercase;
                }

                .xray-tags {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                }

                .tag-pill {
                    font-size: 11px;
                    padding: 4px 10px;
                    border-radius: 12px;
                    color: white;
                    font-weight: 500;
                }

                .tag-pill.blue { background: rgba(59, 130, 246, 0.2); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); }
                .tag-pill.purple { background: rgba(168, 85, 247, 0.2); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.3); }

                .recs-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 12px;
                }

                .rec-card {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                    align-items: center;
                }

                .rec-cover-placeholder {
                    width: 100%;
                    aspect-ratio: 2/3;
                    background: var(--color-bg-tertiary);
                    border-radius: 6px;
                    position: relative;
                    overflow: hidden;
                }
                
                .placeholder-art {
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(brand, transparent);
                    opacity: 0.5;
                }

                .rec-title {
                    font-size: 11px;
                    color: var(--color-text-secondary);
                    text-align: center;
                    line-height: 1.2;
                }

                .collapse-btn {
                    position: absolute;
                    top: 12px;
                    left: -12px; 
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
                }

                @media (max-width: 1024px) {
                    .right-sidebar {
                        position: fixed;
                        z-index: 50;
                        right: 0;
                        bottom: 0;
                        height: calc(100vh - 64px);
                        border-left: 1px solid var(--color-border);
                        transform: translateX(100%); /* Hidden by default */
                    }
                    .right-sidebar.collapsed {
                        transform: translateX(0); /* Used as 'open' state if we invert logic? */
                        /* Actually let's just make it hidden on mobile unless toggled. 
                           User asked to be responsive. 
                           Standard responsive pattern: 3 columns on desktop, 1 on mobile. 
                           Right sidebar usually goes to bottom or becomes hidden drawer.
                        */
                        width: 0;
                    }
                    /* For simplicity in this iteration: hide on mobile, user can't easily access. 
                       Better: Stack it? 
                       The request: "barra lateral derecha (colapsable)..."
                       Let's make it collapse to 0 width on mobile by default.
                    */
                    .right-sidebar {
                        display: none; /* Hide entirely on mobile for now as per standard 'collapsible' patterns on small screens */
                    }
                }
                
                @media (min-width: 1024px) {
                    .right-sidebar {
                        display: flex;
                    }
                }
            `}</style>
        </aside>
    );
}
