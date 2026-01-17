'use client';

import Link from 'next/link';
import { useAppStore, useLibraryStore } from '@/stores/appStore';
import { Search, Moon, Sun, Bell, Plus, User, Menu } from 'lucide-react';

export function TopBar() {
    const { theme, setTheme } = useAppStore();
    const { searchQuery, setSearchQuery } = useLibraryStore();

    const toggleTheme = () => {
        setTheme(theme === 'dark' ? 'light' : 'dark');
    };

    return (
        <header className="topbound">
            <div className="logo-section">
                <Link href="/" className="app-logo">Lectro</Link>
            </div>

            <div className="search-section">
                <div className="search-input-wrapper">
                    <Search className="search-icon" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar libros, autores, etiquetas, x-ray..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="search-input"
                    />
                </div>
            </div>

            <div className="actions-section">
                <button className="btn-icon" onClick={toggleTheme} title="Cambiar tema">
                    {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                </button>
                <button className="btn-icon" title="Notificaciones">
                    <Bell size={20} />
                </button>
                <button className="btn-primary btn-add">
                    <Plus size={18} />
                    <span>Añadir</span>
                </button>
                <div className="user-profile">
                    <div className="avatar-placeholder">
                        <User size={20} />
                    </div>
                </div>
            </div>

            <style jsx>{`
                .topbound {
                    height: 64px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 0 24px;
                    background: var(--color-bg-secondary);
                    border-bottom: 1px solid var(--color-divider);
                }

                .logo-section {
                    width: 260px; /* Aligns with left sidebar */
                }

                .app-logo {
                    font-size: 20px;
                    font-weight: 700;
                    background: linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }

                .search-section {
                    flex: 1;
                    max-width: 600px;
                    margin: 0 24px;
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

                .user-profile {
                    margin-left: 8px;
                }

                .avatar-placeholder {
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    background: var(--color-bg-tertiary);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--color-text-secondary);
                    border: 1px solid var(--color-divider);
                }
            `}</style>
        </header>
    );
}
