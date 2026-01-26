'use client';

import { XRayData, Book } from '@/lib/db';
import { useLibraryStore } from '@/stores/appStore';
import { ArrowLeft, BrainCircuit, Users, MapPin, BookOpen, FileText, Sparkles, Zap } from 'lucide-react';
import { useState } from 'react';

interface XRayViewProps {
    data: XRayData;
    book: Book;
    onBack: () => void;
}

export function XRayView({ data, book, onBack }: XRayViewProps) {
    const [activeSection, setActiveSection] = useState<'overview' | 'characters' | 'world'>('overview');

    return (
        <div className="xray-dashboard animate-fade-in">
            {/* Header / Navigation */}
            <div className="dashboard-header">
                <button onClick={onBack} className="back-btn">
                    <ArrowLeft size={20} />
                    <span>Volver a la biblioteca</span>
                </button>
                <div className="book-context">
                    <span className="label">ADN del Libro</span>
                    <h1 className="title">{book.title}</h1>
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
                    padding: 24px 40px;
                    border-bottom: 1px solid var(--color-border);
                    background: var(--color-bg-secondary);
                    position: sticky;
                    top: 0;
                    z-index: 10;
                    backdrop-filter: blur(10px);
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
                    text-align: center;
                }
                .book-context .label {
                    font-size: 11px;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    color: var(--color-accent);
                    font-weight: 700;
                }
                .book-context .title {
                    font-size: 18px;
                    margin: 0;
                    font-weight: 600;
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
                    max-width: 1400px;
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
                }
                .nav-item:hover { background: var(--color-bg-tertiary); color: var(--color-text-primary); }
                .nav-item.active {
                    background: var(--color-bg-elevated);
                    color: var(--color-accent);
                    border-color: var(--color-border);
                    box-shadow: var(--shadow-sm);
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
                    max-width: 900px;
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

                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-slide-up { animation: slideUp 0.4s ease-out; }
            `}</style>
        </div>
    );
}
