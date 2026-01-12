'use client';

import { useState, useRef, useEffect } from 'react';
import { Book, updateBook } from '@/lib/db';
import { useLibraryStore } from '@/stores/appStore';
import { useRouter } from 'next/navigation';

interface BookDetailsModalProps {
    book: Book;
    onClose: () => void;
}

export function BookDetailsModal({ book: initialBook, onClose }: BookDetailsModalProps) {
    const [book, setBook] = useState<Book>(initialBook);
    const [isEditing, setIsEditing] = useState(false);
    const { updateBook: updateBookInStore } = useLibraryStore();
    const router = useRouter();
    const modalRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    const handleStatusChange = async (status: Book['status']) => {
        try {
            await updateBook(book.id, { status });
            updateBookInStore(book.id, { status });
            setBook({ ...book, status });
        } catch (error) {
            console.error('Failed to update status:', error);
        }
    };

    const handleRead = () => {
        router.push(`/reader/${book.id}`);
    };

    const handleDownload = () => {
        // Create a download link for the blob
        if (book.fileBlob) {
            const url = URL.createObjectURL(book.fileBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = book.fileName || `${book.title}.epub`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    };

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return '-';
        try {
            return new Date(dateString).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch (e) {
            return dateString;
        }
    };

    return (
        <div className="modal-overlay open">
            <div className="modal-container" ref={modalRef}>
                <button className="close-btn" onClick={onClose}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>

                <div className="modal-content">
                    <div className="cover-section">
                        <div className="book-cover-wrapper">
                            {book.cover ? (
                                <img src={book.cover} alt={book.title} className="book-cover" />
                            ) : (
                                <div className="book-cover-placeholder">
                                    <span>{book.title[0]}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="info-section">
                        <div className="header-info">
                            {isEditing ? (
                                <div className="edit-form-group">
                                    <input
                                        className="edit-input author-input"
                                        value={book.author}
                                        onChange={(e) => setBook({ ...book, author: e.target.value })}
                                        placeholder="Author"
                                    />
                                    <input
                                        className="edit-input title-input"
                                        value={book.title}
                                        onChange={(e) => setBook({ ...book, title: e.target.value })}
                                        placeholder="Title"
                                    />
                                </div>
                            ) : (
                                <>
                                    <h2 className="author-name">{book.author}</h2>
                                    <h1 className="book-title">{book.title}</h1>
                                </>
                            )}
                        </div>

                        <div className="action-buttons">
                            <button className="btn btn-primary btn-read" onClick={handleRead}>
                                Read
                            </button>
                            {!book.isOnServer && (
                                <button className="btn btn-secondary btn-download" onClick={async () => {
                                    try {
                                        if (confirm('¿Subir este libro al servidor?')) {
                                            const { uploadBookToServer } = await import('@/lib/fileSystem');
                                            await uploadBookToServer(book);
                                            // Update local state to hide button immediately
                                            // We might need to mutate the book object or refetch
                                            // For now, let's just alert and re-open or let the user close
                                            alert('Libro subido correctamente al servidor.');
                                            onClose(); // Close modal to force refresh when re-opening? Or trigger a refresh callback?
                                        }
                                    } catch (e) {
                                        alert('Error al subir libro: ' + (e as Error).message);
                                    }
                                }}>
                                    Subir a Cloud
                                </button>
                            )}
                            <button className="btn btn-secondary btn-download" onClick={handleDownload}>
                                Download ({formatFileSize(book.fileSize)})
                            </button>
                        </div>

                        <div className="description-section">
                            <h3 className="section-label">Description</h3>
                            {isEditing ? (
                                <textarea
                                    className="edit-textarea"
                                    value={book.metadata.description || ''}
                                    onChange={(e) => setBook({
                                        ...book,
                                        metadata: { ...book.metadata, description: e.target.value }
                                    })}
                                    placeholder="Description..."
                                />
                            ) : (
                                <div className="description-text">
                                    {book.metadata.description || 'No description available.'}
                                </div>
                            )}
                        </div>

                        <div className="metadata-grid">
                            <div className="metadata-item">
                                <span className="meta-label">Publication Date</span>
                                {isEditing ? (
                                    <input
                                        type="date"
                                        className="edit-input-sm"
                                        value={book.metadata.publishedDate || ''}
                                        onChange={(e) => setBook({
                                            ...book,
                                            metadata: { ...book.metadata, publishedDate: e.target.value }
                                        })}
                                    />
                                ) : (
                                    <span className="meta-value">{formatDate(book.metadata.publishedDate)}</span>
                                )}
                            </div>
                            <div className="metadata-item">
                                <span className="meta-label">Language</span>
                                {isEditing ? (
                                    <input
                                        className="edit-input-sm"
                                        value={book.metadata.language || ''}
                                        onChange={(e) => setBook({
                                            ...book,
                                            metadata: { ...book.metadata, language: e.target.value }
                                        })}
                                    />
                                ) : (
                                    <span className="meta-value">{book.metadata.language || '-'}</span>
                                )}
                            </div>
                            <div className="metadata-item">
                                <span className="meta-label">Format</span>
                                <span className="meta-value upp">{book.format}</span>
                            </div>
                            <div className="metadata-item">
                                <span className="meta-label">Publisher</span>
                                {isEditing ? (
                                    <input
                                        className="edit-input-sm"
                                        value={book.metadata.publisher || ''}
                                        onChange={(e) => setBook({
                                            ...book,
                                            metadata: { ...book.metadata, publisher: e.target.value }
                                        })}
                                    />
                                ) : (
                                    <span className="meta-value">{book.metadata.publisher || '-'}</span>
                                )}
                            </div>
                        </div>

                        <div className="tags-section">
                            <h3 className="section-label">Tags</h3>
                            {isEditing ? (
                                <input
                                    className="edit-input"
                                    value={book.metadata.tags?.join(', ') || ''}
                                    onChange={(e) => setBook({
                                        ...book,
                                        metadata: {
                                            ...book.metadata,
                                            tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
                                        }
                                    })}
                                    placeholder="Tags (comma separated)"
                                />
                            ) : (
                                <div className="tags-list">
                                    {book.metadata.tags?.map((tag, i) => (
                                        <span key={i} className={`tag ${tag.toLowerCase()}`}>{tag}</span>
                                    )) || (
                                            <span className="no-tags">-</span>
                                        )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="modal-footer">
                    <div className="status-dropdown-wrapper">
                        <select
                            className="status-select"
                            value={book.status || 'planToRead'}
                            onChange={(e) => handleStatusChange(e.target.value as Book['status'])}
                        >
                            <option value="reading">Currently Reading</option>
                            <option value="planToRead">Plan to Read</option>
                            <option value="completed">Completed</option>
                        </select>
                    </div>

                    <div className="footer-actions">
                        <button
                            className={`btn-icon ${book.status === 'favorite' ? 'active-fav' : ''}`}
                            onClick={() => handleStatusChange(book.status === 'favorite' ? 'planToRead' : 'favorite')}
                            title="Toggle Favorite"
                        >
                            <svg viewBox="0 0 24 24" fill={book.status === 'favorite' ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" width="20" height="20">
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                            </svg>
                        </button>
                        <button
                            className={`btn-icon ${isEditing ? 'active-edit' : ''}`}
                            onClick={async () => {
                                if (isEditing) {
                                    // Save changes
                                    try {
                                        await updateBook(book.id, {
                                            title: book.title,
                                            author: book.author,
                                            metadata: book.metadata
                                        });
                                        updateBookInStore(book.id, {
                                            title: book.title,
                                            author: book.author,
                                            metadata: book.metadata
                                        });
                                    } catch (err) {
                                        console.error(err);
                                    }
                                }
                                setIsEditing(!isEditing);
                            }}
                            title={isEditing ? "Save Metadata" : "Edit Metadata"}
                        >
                            {isEditing ? (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                                    <polyline points="17 21 17 13 7 13 7 21" />
                                    <polyline points="7 3 7 8 15 8" />
                                </svg>
                            ) : (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                            )}
                        </button>
                        <button className="btn-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                                <circle cx="12" cy="12" r="1" />
                                <circle cx="19" cy="12" r="1" />
                                <circle cx="5" cy="12" r="1" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.7);
                    backdrop-filter: blur(4px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                    padding: var(--space-4);
                    animation: fadeIn 0.2s ease-out;
                }

                .modal-container {
                    background: #1a1b1e; /* Dark theme background */
                    border-radius: var(--radius-lg);
                    width: 100%;
                    max-width: 800px;
                    max-height: 90vh;
                    display: flex;
                    flex-direction: column;
                    position: relative;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                    color: #fff;
                    overflow: hidden;
                }

                .close-btn {
                    position: absolute;
                    top: var(--space-4);
                    right: var(--space-4);
                    background: transparent;
                    border: none;
                    color: rgba(255,255,255,0.5);
                    cursor: pointer;
                    z-index: 10;
                    padding: var(--space-2);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                }

                .close-btn:hover {
                    background: rgba(255,255,255,0.1);
                    color: #fff;
                }

                .modal-content {
                    display: grid;
                    grid-template-columns: 300px 1fr;
                    gap: var(--space-8);
                    padding: var(--space-8);
                    overflow-y: auto;
                }

                .book-cover-wrapper {
                    width: 100%;
                    aspect-ratio: 2/3;
                    border-radius: var(--radius-md);
                    overflow: hidden;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                }

                .book-cover {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                .book-cover-placeholder {
                    width: 100%;
                    height: 100%;
                    background: var(--gradient-cool);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: var(--text-6xl);
                    font-weight: 700;
                    color: rgba(255,255,255,0.5);
                }

                .info-section {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-6);
                }

                .header-info {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-2);
                }

                .author-name {
                    font-size: var(--text-sm);
                    color: rgba(255,255,255,0.7);
                    font-weight: 500;
                    margin: 0;
                }

                .book-title {
                    font-size: var(--text-3xl);
                    font-weight: 700;
                    margin: 0;
                    line-height: 1.2;
                }

                .action-buttons {
                    display: flex;
                    gap: var(--space-4);
                }

                .btn {
                    flex: 1;
                    height: 44px;
                    border-radius: var(--radius-full);
                    font-weight: 600;
                    font-size: var(--text-sm);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                }

                .btn-read {
                    background: #3b82f6;
                    color: white;
                    border: none;
                }

                .btn-read:hover {
                    background: #2563eb;
                }

                .btn-download {
                    background: transparent;
                    color: #3b82f6;
                    border: 1px solid #3b82f6;
                }

                .btn-download:hover {
                    background: rgba(59, 130, 246, 0.1);
                }

                .section-label {
                    font-size: var(--text-sm);
                    color: rgba(255,255,255,0.5);
                    margin-bottom: var(--space-2);
                    font-weight: 500;
                }

                .description-text {
                    font-size: var(--text-sm);
                    line-height: 1.6;
                    color: rgba(255,255,255,0.9);
                    max-height: 150px;
                    overflow-y: auto;
                }

                .metadata-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: var(--space-4);
                }

                .metadata-item {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .meta-label {
                    font-size: var(--text-xs);
                    color: rgba(255,255,255,0.5);
                }

                .meta-value {
                    font-size: var(--text-sm);
                    font-weight: 500;
                }

                .meta-value.upp {
                    text-transform: uppercase;
                }

                .tags-list {
                    display: flex;
                    flex-wrap: wrap;
                    gap: var(--space-2);
                }

                .tag {
                    background: rgba(255,255,255,0.1);
                    color: rgba(255,255,255,0.8);
                    padding: 4px 12px;
                    border-radius: var(--radius-full);
                    font-size: var(--text-xs);
                    font-weight: 500;
                }
                
                .tag.aventuras { color: #facc15; background: rgba(250, 204, 21, 0.1); }
                .tag.belico { color: #f87171; background: rgba(248, 113, 113, 0.1); }
                .tag.historico { color: #a3e635; background: rgba(163, 230, 53, 0.1); }

                .modal-footer {
                    padding: var(--space-4) var(--space-8);
                    border-top: 1px solid rgba(255,255,255,0.1);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: rgba(0,0,0,0.2);
                }

                .status-select {
                    background: rgba(255,255,255,0.1);
                    border: none;
                    color: #fff;
                    padding: 8px 16px;
                    border-radius: var(--radius-md);
                    font-size: var(--text-sm);
                    cursor: pointer;
                    appearance: none;
                    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
                    background-repeat: no-repeat;
                    background-position: right 8px center;
                    background-size: 16px;
                    padding-right: 32px;
                }

                .footer-actions {
                    display: flex;
                    gap: var(--space-2);
                }

                .btn-icon {
                    width: 36px;
                    height: 36px;
                    border-radius: var(--radius-md);
                    background: transparent;
                    border: none;
                    color: rgba(255,255,255,0.6);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                }

                .btn-icon:hover {
                    background: rgba(255,255,255,0.1);
                    color: #fff;
                }
                
                .btn-icon.active-fav {
                    color: #FFD700;
                }
                
                .btn-icon.active-edit {
                    color: var(--color-accent);
                    background: rgba(var(--color-accent-rgb), 0.1);
                }

                .edit-form-group {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-2);
                    width: 100%;
                }

                .edit-input, .edit-textarea {
                    background: rgba(255,255,255,0.1);
                    border: 1px solid rgba(255,255,255,0.2);
                    color: #fff;
                    padding: 8px 12px;
                    border-radius: var(--radius-md);
                    font-size: var(--text-sm);
                    width: 100%;
                    font-family: inherit;
                }

                .edit-input:focus, .edit-textarea:focus {
                    outline: none;
                    border-color: var(--color-accent);
                    background: rgba(255,255,255,0.15);
                }

                .author-input {
                    font-size: var(--text-sm);
                    font-weight: 500;
                }

                .title-input {
                    font-size: var(--text-xl);
                    font-weight: 700;
                }

                .edit-textarea {
                    min-height: 100px;
                    resize: vertical;
                    line-height: 1.5;
                }

                .edit-input-sm {
                    background: rgba(255,255,255,0.1);
                    border: 1px solid rgba(255,255,255,0.2);
                    color: #fff;
                    padding: 4px 8px;
                    border-radius: var(--radius-sm);
                    font-size: var(--text-sm);
                    width: 100%;
                }
                
                .edit-input-sm:focus {
                     outline: none;
                    border-color: var(--color-accent);
                }

                @media (max-width: 768px) {
                    .modal-content {
                        grid-template-columns: 1fr;
                        padding: var(--space-6);
                    }

                    .book-cover-wrapper {
                        width: 160px;
                        margin: 0 auto;
                    }
                    
                    .info-section {
                        text-align: center;
                    }
                    
                    .header-info {
                        align-items: center;
                    }
                    
                    .metadata-grid {
                        text-align: left;
                    }
                    
                    .tags-list {
                        justify-content: center;
                    }
                }
                
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
            `}</style>
        </div>
    );
}
