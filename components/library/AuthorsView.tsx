'use client';

import { useLibraryStore } from '@/stores/appStore';
import { User, BookOpen } from 'lucide-react';

export function AuthorsView() {
    const { books, searchQuery, setSearchQuery, setView, setActiveCategory } = useLibraryStore();

    // Group books by author
    const authorsMap = books.reduce((acc, book) => {
        const author = book.author || 'Desconocido';
        if (!acc[author]) {
            acc[author] = { name: author, count: 0, cover: book.cover };
        }
        acc[author].count++;
        // Keep the cover of the first book found as a representative image if needed
        if (!acc[author].cover && book.cover) {
            acc[author].cover = book.cover;
        }
        return acc;
    }, {} as Record<string, { name: string; count: number; cover?: string }>);

    // Filter authors based on search query
    let authors = Object.values(authorsMap).sort((a, b) => a.name.localeCompare(b.name));

    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        authors = authors.filter(author =>
            author.name.toLowerCase().includes(query)
        );
    }

    const handleAuthorClick = (authorName: string) => {
        setSearchQuery(authorName);
        setActiveCategory('all');
        setView('library');
    };

    return (
        <div className="page-container animate-fade-in">
            <h2 className="heading-3 mb-6">Autores ({authors.length})</h2>

            {authors.length > 0 ? (
                <div className="authors-grid">
                    {authors.map((author) => (
                        <button
                            key={author.name}
                            className="author-card"
                            onClick={() => handleAuthorClick(author.name)}
                        >
                            <div className="author-avatar">
                                {author.cover ? (
                                    <img src={author.cover} alt={author.name} className="author-cover-bg" />
                                ) : (
                                    <div className="placeholder-bg" />
                                )}
                                <div className="avatar-circle">
                                    <User size={32} />
                                </div>
                            </div>
                            <div className="author-info">
                                <h3 className="author-name">{author.name}</h3>
                                <div className="author-stats">
                                    <BookOpen size={14} />
                                    <span>{author.count} {author.count === 1 ? 'libro' : 'libros'}</span>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            ) : (
                <div className="empty-state">
                    <User size={48} />
                    <p>No se encontraron autores que coincidan con &quot;{searchQuery}&quot;</p>
                </div>
            )}

            <style jsx>{`
                .authors-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                    gap: 24px;
                }

                .author-card {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    background: var(--color-bg-secondary);
                    border: 1px solid var(--color-border);
                    border-radius: 12px;
                    overflow: hidden;
                    cursor: pointer;
                    transition: all 0.2s;
                    text-align: center;
                    padding-bottom: 16px;
                }

                .author-card:hover {
                    transform: translateY(-4px);
                    box-shadow: var(--shadow-md);
                    border-color: var(--color-accent);
                }

                .author-avatar {
                    width: 100%;
                    height: 100px;
                    background: var(--color-bg-tertiary);
                    position: relative;
                    margin-bottom: 32px;
                    display: flex;
                    justify-content: center;
                }

                .author-cover-bg {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    opacity: 0.3;
                    filter: blur(8px);
                }

                .placeholder-bg {
                    width: 100%;
                    height: 100%;
                    background: var(--gradient-cool);
                    opacity: 0.1;
                }

                .avatar-circle {
                    position: absolute;
                    bottom: -24px;
                    width: 64px;
                    height: 64px;
                    border-radius: 50%;
                    background: var(--color-bg-elevated);
                    border: 4px solid var(--color-bg-secondary);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--color-text-secondary);
                    box-shadow: var(--shadow-sm);
                }

                .author-info {
                    padding: 0 16px;
                    width: 100%;
                }

                .author-name {
                    font-size: 16px;
                    font-weight: 600;
                    margin-bottom: 4px;
                    color: var(--color-text-primary);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .author-stats {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                    font-size: 13px;
                    color: var(--color-text-secondary);
                }
            `}</style>
        </div>
    );
}
