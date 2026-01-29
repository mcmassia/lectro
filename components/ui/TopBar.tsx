'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { useAppStore, useLibraryStore } from '@/stores/appStore';
import { Search, Moon, Sun, Bell, Plus, User, Menu, LogOut, Settings, BookOpen, PanelRightOpen, ArrowLeft, X } from 'lucide-react';
import { UserManagementModal } from '@/components/settings/UserManagementModal';

export function TopBar() {
    const { theme, setTheme, setShowImportModal, currentUser, logout, toggleMobileMenu, toggleMobileRightSidebarOpen } = useAppStore();
    const { searchQuery, setSearchQuery } = useLibraryStore();
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [showUserModal, setShowUserModal] = useState(false);
    const [showMobileSearch, setShowMobileSearch] = useState(false);
    const router = useRouter();

    const pathname = usePathname();
    const userMenuRef = useRef<HTMLDivElement>(null);


    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
                setIsUserMenuOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const toggleTheme = () => {
        setTheme(theme === 'dark' ? 'light' : 'dark');
    };

    const handleLogout = () => {
        logout();
        router.push('/login');
    };

    if (pathname === '/login' || pathname?.startsWith('/reader')) return null;

    return (
        <header className="topbound">
            {/* Mobile Search Overlay Mode */}
            {showMobileSearch ? (
                <div className="mobile-search-bar">
                    <button className="btn-icon" onClick={() => setShowMobileSearch(false)}>
                        <ArrowLeft size={24} />
                    </button>
                    <div className="search-input-wrapper full-width">
                        <input
                            type="text"
                            placeholder="Buscar..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="search-input"
                            autoFocus
                        />
                        {searchQuery && (
                            <button className="clear-search-btn" onClick={() => setSearchQuery('')}>
                                <X size={16} />
                            </button>
                        )}
                    </div>
                </div>
            ) : (
                <>
                    <div className="logo-section">
                        <button className="mobile-menu-btn" onClick={toggleMobileMenu}>
                            <Menu size={24} />
                        </button>
                        <Link href="/" style={{ textDecoration: 'none' }}>
                            <div className="app-logo">
                                <div className="logo-icon-wrapper">
                                    <BookOpen size={24} strokeWidth={2.5} />
                                </div>
                                <span className="logo-text">LECTRO</span>
                            </div>
                        </Link>
                    </div>

                    <div className="search-section desktop-only">
                        <div className="search-input-wrapper">
                            <Search className="search-icon" size={18} />
                            <input
                                type="text"
                                placeholder="Buscar libros, autores, etiquetas..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="search-input"
                            />
                        </div>
                    </div>

                    <div className="actions-section">
                        <button className="btn-icon mobile-search-trigger" onClick={() => setShowMobileSearch(true)}>
                            <Search size={22} />
                        </button>
                        <button className="btn-icon desktop-only" onClick={toggleTheme} title="Cambiar tema">
                            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                        </button>
                        <button className="btn-icon desktop-only" title="Notificaciones">
                            <Bell size={20} />
                        </button>
                        <button className="btn-primary btn-add" onClick={() => setShowImportModal(true)}>
                            <Plus size={18} />
                            <span className="desktop-only-text">Añadir</span>
                        </button>
                        <button className="mobile-menu-btn" onClick={toggleMobileRightSidebarOpen}>
                            <PanelRightOpen size={24} />
                        </button>


                        <div className="user-profile-wrapper" ref={userMenuRef}>
                            <button
                                className="avatar-placeholder"
                                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                            >
                                {currentUser?.username ? (
                                    <span className="font-bold">{currentUser.username.charAt(0).toUpperCase()}</span>
                                ) : (
                                    <User size={20} />
                                )}
                            </button>

                            {isUserMenuOpen && currentUser && (
                                <div className="user-dropdown">
                                    <div className="user-info-section">
                                        <p className="username">@{currentUser.username}</p>
                                        <p className="role">{currentUser.isAdmin ? 'Administrador' : 'Lector'}</p>
                                    </div>

                                    <div className="menu-items">
                                        {/* Admin Only Section */}
                                        {currentUser.isAdmin && (
                                            <button
                                                className="menu-item"
                                                onClick={() => {
                                                    setShowUserModal(true);
                                                    setIsUserMenuOpen(false);
                                                }}
                                            >
                                                <User size={16} />
                                                <span>Gestionar Usuarios</span>
                                            </button>
                                        )}

                                        <button className="menu-item">
                                            <Settings size={16} />
                                            <span>Configuración</span>
                                        </button>

                                        <div className="divider"></div>

                                        <button className="menu-item logout" onClick={handleLogout}>
                                            <LogOut size={16} />
                                            <span>Cerrar Sesión</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

            {showUserModal && <UserManagementModal onClose={() => setShowUserModal(false)} />}

            <style jsx>{`
                .topbound {
                    height: 64px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 0 24px;
                    background: var(--color-bg-secondary);
                    border-bottom: 1px solid var(--color-divider);
                    position: relative;
                    z-index: 1000; /* Ensure TopBar is always on top */
                }

                @media (max-width: 1024px) {
                    .topbound {
                        padding: 0 16px;
                        height: var(--header-height);
                    }
                }

                .logo-section {
                    width: 260px; /* Aligns with left sidebar */
                    display: flex;
                    align-items: center;
                }

                @media (max-width: 1024px) {
                    .logo-section {
                        width: auto;
                    }
                }

                .mobile-menu-btn {
                    display: none;
                    background: transparent;
                    border: none;
                    color: var(--color-text-primary);
                    margin-right: 12px;
                    padding: 4px;
                    cursor: pointer;
                }

                @media (max-width: 768px) {
                    .mobile-menu-btn {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    .logo-text {
                        display: none; /* Hide text on mobile to save space if needed, or keep smaller */
                    }
                }

                .app-logo {
                    display: flex;
                    flex-direction: row;
                    align-items: center;
                    gap: 12px;
                    text-decoration: none;
                    white-space: nowrap;
                }

                .logo-icon-wrapper {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 40px;
                    height: 40px;
                    background: var(--color-bg-primary);
                    border-radius: 10px;
                    color: var(--color-accent);
                    box-shadow: var(--shadow-sm);
                    border: 1px solid var(--color-border);
                }

                .logo-text {
                    font-size: 18px;
                    font-weight: 700;
                    letter-spacing: 1.5px;
                    color: var(--color-text-primary);
                    text-transform: uppercase;
                    font-family: var(--font-display, sans-serif); /* Fallback */
                }

                .search-section {
                    flex: 1;
                    max-width: 600px;
                    margin: 0 24px;
                }

                .desktop-only {
                    display: flex;
                }

                .mobile-search-trigger {
                    display: none;
                }
                
                .mobile-search-bar {
                     display: flex;
                     align-items: center;
                     width: 100%;
                     gap: 12px;
                }
                
                .full-width {
                    flex: 1;
                }
                
                .clear-search-btn {
                    background: transparent;
                    border: none;
                    color: var(--color-text-tertiary);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                }

                @media (max-width: 1024px) {
                    .actions-section {
                        gap: 8px;
                    }
                    .search-section.desktop-only {
                        display: none;
                    }
                    .actions-section .desktop-only {
                        display: none;
                    }
                    .mobile-search-trigger {
                        display: flex;
                    }
                    .btn-add span {
                        display: none;
                    }
                    .btn-add {
                        padding: 8px; /* Icon only */
                    }
                }

                .search-input-wrapper {
                    position: relative;
                    display: flex;
                    align-items: center;
                    background: var(--color-bg-tertiary);
                    border-radius: 8px;
                    padding: 0 12px;
                    height: 40px;
                    transition: all 0.2s;
                    border: 1px solid transparent;
                }

                .search-input-wrapper:focus-within {
                    background: var(--color-bg-primary);
                    border-color: var(--color-accent);
                    box-shadow: 0 0 0 2px var(--color-accent-subtle);
                }

                .search-icon {
                    color: var(--color-text-tertiary);
                    margin-right: 8px;
                }

                .search-input {
                    background: transparent;
                    border: none;
                    width: 100%;
                    height: 100%;
                    color: var(--color-text-primary);
                    font-size: 14px;
                }

                .search-input:focus {
                    outline: none;
                }

                .actions-section {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                }

                .btn-icon {
                    background: transparent;
                    border: none;
                    color: var(--color-text-secondary);
                    cursor: pointer;
                    padding: 8px;
                    border-radius: 50%;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .btn-icon:hover {
                    color: var(--color-text-primary);
                    background: var(--color-bg-tertiary);
                }

                .btn-add {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 8px 16px;
                    border-radius: 6px;
                    font-weight: 500;
                    font-size: 14px;
                }

                .user-profile-wrapper {
                    position: relative;
                    margin-left: 8px;
                }

                .avatar-placeholder {
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    background: var(--color-accent);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    border: 1px solid var(--color-divider);
                    cursor: pointer;
                    transition: transform 0.2s;
                    font-size: 14px;
                }

                .avatar-placeholder:hover {
                    transform: scale(1.05);
                }

                .user-dropdown {
                    position: absolute;
                    top: calc(100% + 8px);
                    right: 0;
                    width: 240px;
                    background: var(--color-bg-elevated);
                    border: 1px solid var(--color-border);
                    border-radius: 12px;
                    box-shadow: var(--shadow-lg);
                    overflow: hidden;
                    animation: fadeIn 0.1s ease-out;
                }

                .user-info-section {
                    padding: 16px;
                    border-bottom: 1px solid var(--color-border);
                    background: var(--color-bg-tertiary);
                }

                .username {
                    font-weight: 600;
                    color: var(--color-text-primary);
                    font-size: 14px;
                }

                .role {
                    font-size: 12px;
                    color: var(--color-text-secondary);
                    margin-top: 2px;
                }

                .menu-items {
                    padding: 8px;
                }

                .menu-item {
                    width: 100%;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 10px 12px;
                    border: none;
                    background: transparent;
                    color: var(--color-text-secondary);
                    cursor: pointer;
                    border-radius: 8px;
                    font-size: 14px;
                    transition: all 0.2s;
                    text-align: left;
                }

                .menu-item:hover {
                    background: var(--color-bg-tertiary);
                    color: var(--color-text-primary);
                }

                .menu-item.logout {
                    color: #ef4444;
                }

                .menu-item.logout:hover {
                    background: rgba(239, 68, 68, 0.1);
                }

                .divider {
                    height: 1px;
                    background: var(--color-border);
                    margin: 8px 0;
                }

                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </header>
    );
}
