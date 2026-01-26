'use client';

import { XRayData, Book } from '@/lib/db';
import { useLibraryStore } from '@/stores/appStore';
import { ArrowLeft, BrainCircuit, Users, MapPin, BookOpen, FileText, Sparkles, Zap, Library } from 'lucide-react';
import { useState } from 'react';
import { BookCard } from './BookCard';

interface XRayViewProps {
    data: XRayData;
    book: Book;
    onBack: () => void;
}

export function XRayView({ data, book, onBack }: XRayViewProps) {
    const [activeSection, setActiveSection] = useState<'overview' | 'characters' | 'world' | 'author_books' | 'recommendations'>('overview');
    const { books, setSelectedBookId } = useLibraryStore();

    // Data Filtering for Tabs
    const authorBooks = books.filter(b => b.author === book.author && b.id !== book.id);

    // Simple Recommendation Logic: same category or subjects
    const recommendations = books.filter(b => {
        if (b.id === book.id) return false;
        if (b.author === book.author) return false; // Already in author tab

        const hasCommonCategory = b.metadata?.categories?.some(c => book.metadata?.categories?.includes(c));
        const hasCommonSubject = b.metadata?.subjects?.some(s => book.metadata?.subjects?.includes(s));

        return hasCommonCategory || hasCommonSubject;
    }).slice(0, 8); // Limit to 8

    return (
        <div className="xray-dashboard animate-fade-in">
            {/* Header / Navigation */}
            <div className="dashboard-header h-32">
                <button onClick={onBack} className="back-btn">
                    <ArrowLeft size={20} />
                    <span>Volver</span>
                </button>

                <div className="header-content">
                    {/* Book Cover in Header */}
                    <div className="header-cover shadow-lg">
                        <img
                            src={book.isOnServer || book.filePath ? `/api/covers/${book.id}?width=200&v=${new Date(book.updatedAt || 0).getTime()}` : (book.cover || '/default-cover.png')}
                            alt={book.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                                (e.target as HTMLImageElement).src = '/default-cover.png';
                            }}
                        />
                    </div>

                    <div className="book-context text-left">
                        <span className="label">ADN del Libro</span>
                        <h1 className="title text-2xl">{book.title}</h1>
                        <p className="author text-lg text-gray-400 font-medium">{book.author}</p>
                    </div>
                </div>

                <div className="header-actions">
                    <button className="action-btn primary">
                        <Sparkles size={16} />
                        <span>Chat con IA</span>
                    </button>
                </div>
            </div>

            {/* Main Layout Grid */}
            <div className="dashboard-grid">

                {/* Left Column: Navigation & Quick Stats */}
                <div className="dashboard-sidebar">
                    <div className="nav-menu">
                        <button
                            className={`nav-item ${activeSection === 'overview' ? 'active' : ''}`}
                            onClick={() => setActiveSection('overview')}
                        >
                            <BrainCircuit size={18} />
                            <span>Visión General</span>
                        </button>
                        <button
                            className={`nav-item ${activeSection === 'characters' ? 'active' : ''}`}
                            onClick={() => setActiveSection('characters')}
                        >
                            <Users size={18} />
                            <span>Personajes</span>
                        </button>
                        <button
                            className={`nav-item ${activeSection === 'world' ? 'active' : ''}`}
                            onClick={() => setActiveSection('world')}
                        >
                            <MapPin size={18} />
                            <span>Mundo y Lugares</span>
                        </button>

                        <div className="nav-separator"></div>

                        <button
                            className={`nav-item ${activeSection === 'author_books' ? 'active' : ''}`}
                            onClick={() => setActiveSection('author_books')}
                        >
                            <Library size={18} />
                            <span>Más de {book.author?.split(' ')[0] || 'Autor'}</span>
                            {authorBooks.length > 0 && <span className="nav-badge">{authorBooks.length}</span>}
                        </button>
                        <button
                            className={`nav-item ${activeSection === 'recommendations' ? 'active' : ''}`}
                            onClick={() => setActiveSection('recommendations')}
                        >
                            <Sparkles size={18} />
                            <span>Similares</span>
                            {recommendations.length > 0 && <span className="nav-badge">{recommendations.length}</span>}
                        </button>
                    </div>

                    <div className="stat-card">
                        <div className="stat-icon">
                            <Zap size={20} />
                        </div>
                        <div className="stat-content">
                            <span className="stat-label">Conceptos Clave</span>
                            <span className="stat-value">{data.terms?.length || 0}</span>
                        </div>
                    </div>
                </div>

                {/* Right Column: Content Area */}
                <div className="dashboard-content">

                    {activeSection === 'overview' && (
                        <div className="content-slide animate-slide-up">
                            {/* Summary Card */}
                            <div className="content-card featured">
                                <div className="card-header">
                                    <FileText size={20} className="icon-accent" />
                                    <h3>Resumen Ejecutivo</h3>
                                </div>
                                <p className="text-body lead">{data.summary}</p>
                            </div>

                            {/* Plot & Key Points Grid */}
                            <div className="dual-grid">
                                <div className="content-card">
                                    <div className="card-header">
                                        <BookOpen size={20} className="icon-secondary" />
                                        <h3>Trama Principal</h3>
                                    </div>
                                    <p className="text-body">{data.plot}</p>
                                </div>

                                <div className="content-card">
                                    <div className="card-header">
                                        <Zap size={20} className="icon-accent" />
                                        <h3>Puntos Clave</h3>
                                    </div>
                                    <ul className="key-points-list">
                                        {data.keyPoints?.map((point, i) => (
                                            <li key={i}>{point}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeSection === 'characters' && (
                        <div className="content-slide animate-slide-up">
                            <div className="section-header">
                                <h2>Elenco de Personajes</h2>
                                <p>Análisis de relaciones y roles principales</p>
                            </div>

                            <div className="characters-grid">
                                {data.characters?.map((char, i) => (
                                    <div key={i} className={`character-card ${char.importance}`}>
                                        <div className="char-avatar">
                                            {char.name.charAt(0)}
                                        </div>
                                        <div className="char-info">
                                            <div className="char-header">
                                                <h4>{char.name}</h4>
                                                <span className={`badge ${char.importance}`}>
                                                    {char.importance === 'main' ? 'Protagonista' : char.importance === 'secondary' ? 'Secundario' : 'Extra'}
                                                </span>
                                            </div>
                                            <p>{char.description}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeSection === 'world' && (
                        <div className="content-slide animate-slide-up">
                            <div className="section-header">
                                <h2>Lugares y Escenarios</h2>
                                <p>Geografía narrativa de la obra</p>
                            </div>

                            <div className="places-grid">
                                {data.places?.map((place, i) => (
                                    <div key={i} className="place-card">
                                        <div className="place-icon">
                                            <MapPin size={24} />
                                        </div>
                                        <div className="place-content">
                                            <h4>{place.name}</h4>
                                            <p>{place.description}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeSection === 'author_books' && (
                        <div className="content-slide animate-slide-up">
                            <div className="section-header">
                                <h2>Más de {book.author}</h2>
                                <p>Otros títulos de este autor en tu biblioteca</p>
                            </div>

                            {authorBooks.length > 0 ? (
                                <div className="book-grid-display">
                                    {authorBooks.map(b => (
                                        <div key={b.id} className="transform scale-90 origin-top-left hover:scale-100 transition-all duration-200">
                                            {/* Reuse existing Book Card style but inert or navigating */}
                                            <BookCard
                                                book={b}
                                                viewMode="grid"
                                                onClick={() => {
                                                    // This will trigger the global selection and reload the view
                                                    useLibraryStore.getState().setSelectedBookId(b.id);
                                                }}
                                            />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="empty-state">
                                    <Library size={48} className="text-gray-600 mb-4" />
                                    <p>No tienes más libros de este autor.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {activeSection === 'recommendations' && (
                        <div className="content-slide animate-slide-up">
                            <div className="section-header">
                                <h2>Recomendaciones</h2>
                                <p>Libros similares basados en género y temática</p>
                            </div>

                            {recommendations.length > 0 ? (
                                <div className="book-grid-display">
                                    {recommendations.map(b => (
                                        <div key={b.id} className="transform scale-90 origin-top-left hover:scale-100 transition-all duration-200">
                                            <BookCard
                                                book={b}
                                                viewMode="grid"
                                                onClick={() => {
                                                    useLibraryStore.getState().setSelectedBookId(b.id);
                                                }}
                                            />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="empty-state">
                                    <Sparkles size={48} className="text-gray-600 mb-4" />
                                    <p>No encontramos recomendaciones directas. ¡Importa más libros!</p>
                                </div>
                            )}
                        </div>
                    )}

                </div>
            </div>

            <style jsx>{`
                .xray-dashboard {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    background: var(--color-bg-primary);
                    color: var(--color-text-primary);
                    overflow: auto;
                }

                .dashboard-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 16px 40px;
                    border-bottom: 1px solid var(--color-border);
                    background: var(--color-bg-secondary);
                    position: sticky;
                    top: 0;
                    z-index: 10;
                    backdrop-filter: blur(10px);
                    height: auto;
                    min-height: 100px;
                }

                .header-content {
                    display: flex;
                    align-items: center;
                    gap: 24px;
                    flex: 1;
                    justify-content: center; /* Center block */
                    margin-left: 40px; /* Offset back button */
                }

                .header-cover {
                    width: 60px;
                    height: 90px;
                    border-radius: 6px;
                    overflow: hidden;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                    flex-shrink: 0;
                }

                .back-btn {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    color: var(--color-text-secondary);
                    font-weight: 500;
                    transition: color 0.2s;
                }
                .back-btn:hover { color: var(--color-text-primary); }

                .book-context {
                    text-align: left;
                }
                .book-context .label {
                    font-size: 11px;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    color: var(--color-accent);
                    font-weight: 700;
                    display: block;
                    margin-bottom: 4px;
                }
                .book-context .title {
                    font-size: 24px;
                    margin: 0;
                    font-weight: 700;
                    line-height: 1.2;
                }
                .book-context .author {
                    font-size: 16px;
                    margin: 0;
                    color: var(--color-text-secondary);
                }

                .action-btn.primary {
                    background: var(--color-accent);
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 100px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-weight: 600;
                    cursor: pointer;
                    box-shadow: 0 4px 12px rgba(168, 85, 247, 0.3);
                    transition: all 0.2s;
                }
                .action-btn.primary:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(168, 85, 247, 0.4); }

                .dashboard-grid {
                    display: grid;
                    grid-template-columns: 260px 1fr;
                    flex: 1;
                    max-width: 1600px;
                    width: 100%;
                    margin: 0 auto;
                }

                .dashboard-sidebar {
                    padding: 32px 24px;
                    border-right: 1px solid var(--color-border);
                    display: flex;
                    flex-direction: column;
                    gap: 32px;
                }

                .nav-menu {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .nav-separator {
                    height: 1px;
                    background: var(--color-border);
                    margin: 8px 0;
                }

                .nav-item {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 12px 16px;
                    border-radius: 12px;
                    color: var(--color-text-secondary);
                    font-weight: 500;
                    transition: all 0.2s;
                    border: 1px solid transparent;
                    text-align: left;
                    position: relative;
                }
                .nav-item:hover { background: var(--color-bg-tertiary); color: var(--color-text-primary); }
                .nav-item.active {
                    background: var(--color-bg-elevated);
                    color: var(--color-accent);
                    border-color: var(--color-border);
                    box-shadow: var(--shadow-sm);
                }
                
                .nav-badge {
                    margin-left: auto;
                    background: var(--color-bg-tertiary);
                    color: var(--color-text-secondary);
                    font-size: 10px;
                    padding: 2px 6px;
                    border-radius: 10px;
                    font-weight: 700;
                }
                .nav-item.active .nav-badge {
                    background: rgba(168, 85, 247, 0.1);
                    color: var(--color-accent);
                }

                .stat-card {
                    background: linear-gradient(135deg, var(--color-bg-tertiary), var(--color-bg-secondary));
                    padding: 20px;
                    border-radius: 16px;
                    border: 1px solid var(--color-border);
                    display: flex;
                    align-items: center;
                    gap: 16px;
                }
                .stat-icon {
                    width: 40px;
                    height: 40px;
                    background: rgba(168, 85, 247, 0.1);
                    color: var(--color-accent);
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .stat-content { display: flex; flex-direction: column; }
                .stat-label { font-size: 12px; color: var(--color-text-secondary); text-transform: uppercase; font-weight: 600; }
                .stat-value { font-size: 24px; font-weight: 700; color: var(--color-text-primary); line-height: 1.2; }

                .dashboard-content {
                    padding: 40px 60px;
                    overflow-y: auto;
                }

                .content-slide {
                    display: flex;
                    flex-direction: column;
                    gap: 32px;
                    max-width: 1000px;
                }
                
                .section-header { margin-bottom: 16px; }
                .section-header h2 { font-size: 28px; margin: 0 0 8px 0; }
                .section-header p { color: var(--color-text-secondary); margin: 0; font-size: 16px; }

                .content-card {
                    background: var(--color-bg-secondary);
                    border: 1px solid var(--color-border);
                    border-radius: 16px;
                    padding: 32px;
                    box-shadow: var(--shadow-sm);
                }
                .content-card.featured {
                    border-left: 4px solid var(--color-accent);
                }

                .card-header {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 20px;
                }
                .card-header h3 { margin: 0; font-size: 18px; font-weight: 600; }
                .icon-accent { color: var(--color-accent); }
                .icon-secondary { color: var(--color-text-secondary); }

                .text-body {
                    line-height: 1.8;
                    color: var(--color-text-primary);
                    font-size: 16px;
                    margin: 0;
                }
                .text-body.lead { font-size: 18px; color: var(--color-text-primary); }

                .dual-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 24px;
                }

                .key-points-list {
                    padding-left: 20px;
                    margin: 0;
                }
                .key-points-list li {
                    margin-bottom: 12px;
                    color: var(--color-text-secondary);
                }
                .key-points-list li::marker { color: var(--color-accent); }

                /* Characters Grid */
                .characters-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                    gap: 20px;
                }
                .character-card {
                    background: var(--color-bg-secondary);
                    border: 1px solid var(--color-border);
                    border-radius: 16px;
                    padding: 20px;
                    display: flex;
                    gap: 16px;
                    transition: transform 0.2s;
                }
                .character-card:hover { transform: translateY(-2px); border-color: var(--color-accent); }
                
                .char-avatar {
                    width: 48px;
                    height: 48px;
                    background: linear-gradient(135deg, #e0e7ff, #c7d2fe);
                    color: #4f46e5;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 20px;
                    font-weight: 700;
                    flex-shrink: 0;
                }
                .character-card.main .char-avatar { background: linear-gradient(135deg, #f3e8ff, #d8b4fe); color: #9333ea; }
                
                .char-info { flex: 1; }
                .char-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
                .char-header h4 { margin: 0; font-size: 16px; font-weight: 600; }
                
                .badge {
                    font-size: 10px;
                    padding: 2px 8px;
                    border-radius: 100px;
                    text-transform: uppercase;
                    font-weight: 700;
                }
                .badge.main { background: rgba(147, 51, 234, 0.1); color: #9333ea; }
                .badge.secondary { background: rgba(59, 130, 246, 0.1); color: #2563eb; }
                .badge.minor { background: var(--color-bg-tertiary); color: var(--color-text-tertiary); }
                
                .char-info p { margin: 0; font-size: 13px; color: var(--color-text-secondary); line-height: 1.5; }

                /* Places Grid */
                .places-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 20px;
                }
                .place-card {
                    background: var(--color-bg-tertiary);
                    padding: 24px;
                    border-radius: 16px;
                    display: flex;
                    gap: 20px;
                    align-items: flex-start;
                }
                .place-icon { color: var(--color-text-tertiary); }
                .place-content h4 { margin: 0 0 8px 0; font-size: 16px; font-weight: 600; }
                .place-content p { margin: 0; font-size: 14px; color: var(--color-text-secondary); line-height: 1.5; }
                
                /* Book List Grid */
                .book-grid-display {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
                    gap: 20px;
                }
                
                .empty-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 60px;
                    background: var(--color-bg-secondary);
                    border-radius: 16px;
                    color: var(--color-text-secondary);
                }

                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-slide-up { animation: slideUp 0.4s ease-out; }
            `}</style>
        </div>
    );
}
