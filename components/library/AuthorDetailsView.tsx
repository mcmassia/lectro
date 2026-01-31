'use client';

import { useState, useEffect } from 'react';
import { useLibraryStore } from '@/stores/appStore';
import { BookCard } from './BookCard';
import { searchBooksByAuthor, GoogleBook } from '@/lib/services/googleBooks';
import { ArrowLeft, BookOpen, Globe, Library, ExternalLink, Search } from 'lucide-react';

interface AuthorDetailsViewProps {
    author: string;
    onBack: () => void;
}

export function AuthorDetailsView({ author, onBack }: AuthorDetailsViewProps) {
    const { books, setView, setSelectedBookId } = useLibraryStore();
    const [activeTab, setActiveTab] = useState<'library' | 'discover'>('library');
    const [externalBooks, setExternalBooks] = useState<GoogleBook[]>([]);
    const [isLoadingExternal, setIsLoadingExternal] = useState(false);

    // Filter local books
    const localBooks = books.filter(b => b.author === author);

    // Fetch external books on mount
    useEffect(() => {
        const fetchExternal = async () => {
            setIsLoadingExternal(true);
            try {
                const results = await searchBooksByAuthor(author);
                // Filter out books we already have (approximate match by title)
                const localTitles = new Set(localBooks.map(b => b.title.toLowerCase()));
                const filtered = results.filter(b => !localTitles.has(b.volumeInfo.title.toLowerCase()));
                setExternalBooks(filtered);
            } catch (e) {
                console.error("Failed to fetch external books", e);
            } finally {
                setIsLoadingExternal(false);
            }
        };

        if (activeTab === 'discover' && externalBooks.length === 0) {
            fetchExternal();
        }
    }, [author, activeTab]);

    return (
        <div className="author-details-view animate-fade-in">
            {/* Header */}
            <div className="view-header">
                <button className="back-btn" onClick={onBack}>
                    <ArrowLeft size={20} />
                    <span>Volver</span>
                </button>
                <div className="header-info">
                    <h1 className="author-name">{author}</h1>
                    <div className="author-stats">
                        <span className="sc-badge">
                            <Library size={14} />
                            {localBooks.length} en biblioteca
                        </span>
                        {externalBooks.length > 0 && (
                            <span className="sc-badge secondary">
                                <Globe size={14} />
                                {externalBooks.length}+ descubiertos
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="tabs-container">
                <button
                    className={`tab-btn ${activeTab === 'library' ? 'active' : ''}`}
                    onClick={() => setActiveTab('library')}
                >
                    <Library size={16} />
                    <span>En tu Biblioteca</span>
                </button>
                <button
                    className={`tab-btn ${activeTab === 'discover' ? 'active' : ''}`}
                    onClick={() => setActiveTab('discover')}
                >
                    <Globe size={16} />
                    <span>Descubrir Más</span>
                </button>
            </div>

            {/* Content */}
            <div className="view-content">
                {activeTab === 'library' && (
                    <div className="books-grid">
                        {localBooks.map(book => (
                            <BookCard
                                key={book.id}
                                book={book}
                                viewMode="grid"
                                onClick={() => {
                                    setSelectedBookId(book.id);
                                    setView('book-details');
                                }}
                            />
                        ))}
                    </div>
                )}

                {activeTab === 'discover' && (
                    <div className="external-section">
                        {isLoadingExternal ? (
                            <div className="loading-state">
                                <div className="animate-spin h-8 w-8 border-2 border-accent border-t-transparent rounded-full mb-4"></div>
                                <p>Buscando libros de {author}...</p>
                            </div>
                        ) : externalBooks.length > 0 ? (
                            <div className="books-grid">
                                {externalBooks.map((gb, i) => (
                                    <div key={gb.id || i} className="google-book-card">
                                        <div className="gb-cover">
                                            {gb.volumeInfo.imageLinks?.thumbnail ? (
                                                <img src={gb.volumeInfo.imageLinks?.thumbnail} alt={gb.volumeInfo.title} />
                                            ) : (
                                                <div className="placeholder-cover">{gb.volumeInfo.title[0]}</div>
                                            )}
                                        </div>
                                        <div className="gb-info">
                                            <h4>{gb.volumeInfo.title}</h4>
                                            <p className="gb-year">{gb.volumeInfo.publishedDate?.substring(0, 4) || 'Año desconocido'}</p>
                                            <p className="gb-desc">{gb.volumeInfo.description?.substring(0, 100)}...</p>
                                            <a
                                                href={gb.volumeInfo.previewLink || gb.volumeInfo.infoLink}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="gb-link"
                                            >
                                                Ver en Internet <ExternalLink size={12} />
                                            </a>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="empty-state">
                                <Search size={48} />
                                <p>No se encontraron más libros de este autor externamente.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <style jsx>{`
                .author-details-view {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    background: var(--color-bg-primary);
                    color: var(--color-text-primary);
                    overflow: hidden;
                }

                .view-header {
                    padding: 24px 40px;
                    background: var(--color-bg-secondary);
                    border-bottom: 1px solid var(--color-border);
                    display: flex;
                    align-items: center;
                    gap: 32px;
                }

                .back-btn {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    background: none;
                    border: none;
                    color: var(--color-text-secondary);
                    font-weight: 500;
                    cursor: pointer;
                    font-size: 16px;
                }
                .back-btn:hover { color: var(--color-text-primary); }

                .author-name {
                    margin: 0;
                    font-size: 28px;
                    font-weight: 700;
                }

                .header-info {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .author-stats {
                    display: flex;
                    gap: 12px;
                }

                .sc-badge {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 12px;
                    padding: 4px 12px;
                    background: rgba(168, 85, 247, 0.1);
                    color: var(--color-accent);
                    border-radius: 99px;
                    font-weight: 500;
                }
                .sc-badge.secondary {
                    background: var(--color-bg-tertiary);
                    color: var(--color-text-secondary);
                }

                .tabs-container {
                    display: flex;
                    gap: 24px;
                    padding: 0 40px;
                    border-bottom: 1px solid var(--color-border);
                    background: var(--color-bg-secondary);
                }

                .tab-btn {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 16px 4px;
                    background: none;
                    border: none;
                    border-bottom: 2px solid transparent;
                    color: var(--color-text-secondary);
                    cursor: pointer;
                    font-weight: 500;
                    transition: all 0.2s;
                }
                .tab-btn:hover { color: var(--color-text-primary); }
                .tab-btn.active {
                    color: var(--color-accent);
                    border-bottom-color: var(--color-accent);
                }

                .view-content {
                    flex: 1;
                    overflow-y: auto;
                    padding: 40px;
                }

                .books-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
                    gap: 32px;
                }

                .google-book-card {
                    background: var(--color-bg-secondary);
                    border: 1px solid var(--color-border);
                    border-radius: 12px;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    transition: transform 0.2s;
                }
                .google-book-card:hover { transform: translateY(-4px); border-color: var(--color-accent); }

                .gb-cover {
                    aspect-ratio: 2/3;
                    width: 100%;
                    background: var(--color-bg-tertiary);
                    overflow: hidden;
                }
                .gb-cover img { width: 100%; height: 100%; object-fit: cover; }
                .placeholder-cover {
                    width: 100%; height: 100%;
                    display: flex; align-items: center;
                    justify-content: center;
                    font-size: 48px;
                    color: var(--color-text-tertiary);
                }

                .gb-info {
                    padding: 16px;
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .gb-info h4 { margin: 0; font-size: 14px; font-weight: 600; line-height: 1.4; }
                .gb-year { margin: 0; font-size: 12px; color: var(--color-text-tertiary); }
                .gb-desc { font-size: 12px; color: var(--color-text-secondary); display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; flex: 1; }
                
                .gb-link {
                    margin-top: auto;
                    font-size: 12px;
                    color: var(--color-accent);
                    text-decoration: none;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }
                .gb-link:hover { text-decoration: underline; }

                .loading-state, .empty-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 60px;
                    color: var(--color-text-secondary);
                    text-align: center;
                    gap: 16px;
                }

                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .animate-fade-in { animation: fadeIn 0.3s ease-out; }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            `}</style>
        </div>
    );
}
