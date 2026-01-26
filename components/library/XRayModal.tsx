'use client';

import { XRayData } from '@/lib/db';
import { X, Users, MapPin, BookOpen, FileText, BrainCircuit } from 'lucide-react';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface XRayModalProps {
    data: XRayData;
    onClose: () => void;
}

export function XRayModal({ data, onClose }: XRayModalProps) {
    const [activeTab, setActiveTab] = useState<'overview' | 'characters' | 'places' | 'terms'>('overview');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        console.log('XRayModal mounted', { data });
        setMounted(true);
        // Prevent body scroll when modal is open
        document.body.style.overflow = 'hidden';
        return () => {
            console.log('XRayModal unmounting');
            document.body.style.overflow = 'unset';
            setMounted(false);
        };
    }, [data]);

    if (!mounted) return null;

    return createPortal(
        <div className="modal-overlay" onClick={(e) => {
            // Close on click outside if desired, strictly on overlay
            if (e.target === e.currentTarget) onClose();
        }}>
            <div className="modal-container xray-modal">
                <button className="close-btn" onClick={onClose}>
                    <X size={24} />
                </button>

                <div className="xray-header">
                    <div className="header-badge">
                        <BrainCircuit size={16} />
                        <span>Book DNA</span>
                    </div>
                    <h2>Análisis Profundo</h2>
                </div>

                <div className="xray-tabs">
                    <button
                        className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
                        onClick={() => setActiveTab('overview')}
                    >
                        <FileText size={16} />
                        Resumen
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'characters' ? 'active' : ''}`}
                        onClick={() => setActiveTab('characters')}
                    >
                        <Users size={16} />
                        Personajes
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'places' ? 'active' : ''}`}
                        onClick={() => setActiveTab('places')}
                    >
                        <MapPin size={16} />
                        Lugares
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'terms' ? 'active' : ''}`}
                        onClick={() => setActiveTab('terms')}
                    >
                        <BookOpen size={16} />
                        Términos
                    </button>
                </div>

                <div className="xray-content">
                    {activeTab === 'overview' && (
                        <div className="tab-pane animate-fade-in">
                            <div className="section-block">
                                <h3>Resumen Ejecutivo</h3>
                                <p className="text-body">{data.summary}</p>
                            </div>

                            {data.plot && (
                                <div className="section-block">
                                    <h3>Trama y Argumento</h3>
                                    <p className="text-body">{data.plot}</p>
                                </div>
                            )}

                            {data.keyPoints && data.keyPoints.length > 0 && (
                                <div className="section-block">
                                    <h3>Puntos Clave</h3>
                                    <ul className="key-points-list">
                                        {data.keyPoints.map((point, i) => (
                                            <li key={i}>{point}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'characters' && (
                        <div className="tab-pane animate-fade-in">
                            <div className="grid-list">
                                {data.characters?.map((char, i) => (
                                    <div key={i} className="card-item">
                                        <div className="card-header">
                                            <h4>{char.name}</h4>
                                            <span className={`importance-badge ${char.importance}`}>
                                                {char.importance === 'main' ? 'Principal' : char.importance === 'secondary' ? 'Secundario' : 'Menor'}
                                            </span>
                                        </div>
                                        <p>{char.description}</p>
                                    </div>
                                ))}
                                {(!data.characters || data.characters.length === 0) && (
                                    <p className="empty-state">No hay información de personajes disponible.</p>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'places' && (
                        <div className="tab-pane animate-fade-in">
                            <div className="grid-list">
                                {data.places?.map((place, i) => (
                                    <div key={i} className="card-item">
                                        <h4>{place.name}</h4>
                                        <p>{place.description}</p>
                                    </div>
                                ))}
                                {(!data.places || data.places.length === 0) && (
                                    <p className="empty-state">No hay información de lugares disponible.</p>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'terms' && (
                        <div className="tab-pane animate-fade-in">
                            <div className="grid-list">
                                {data.terms?.map((term, i) => (
                                    <div key={i} className="card-item">
                                        <h4>{term.name}</h4>
                                        <p>{term.description}</p>
                                    </div>
                                ))}
                                {(!data.terms || data.terms.length === 0) && (
                                    <p className="empty-state">No hay términos específicos registrados.</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <style jsx>{`
                .modal-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.75);
                    backdrop-filter: blur(4px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000; /* Ensure it's top level */
                    animation: fadeIn 0.2s ease-out;
                }

                .xray-modal {
                    background: var(--color-bg-secondary);
                    width: 90%;
                    max-width: 900px;
                    height: 85vh;
                    border-radius: 16px;
                    display: flex;
                    flex-direction: column;
                    position: relative;
                    overflow: hidden;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                    border: 1px solid var(--color-border);
                }

                .close-btn {
                    position: absolute;
                    top: 16px;
                    right: 16px;
                    background: transparent;
                    border: none;
                    color: var(--color-text-secondary);
                    cursor: pointer;
                    padding: 8px;
                    border-radius: 50%;
                    transition: all 0.2s;
                    z-index: 10;
                }
                
                .close-btn:hover {
                    background: var(--color-bg-tertiary);
                    color: var(--color-text-primary);
                }

                .xray-header {
                    padding: 24px 32px;
                    border-bottom: 1px solid var(--color-divider);
                    background: var(--color-bg-elevated);
                }

                .header-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 11px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    color: #a855f7;
                    background: rgba(168, 85, 247, 0.1);
                    padding: 4px 10px;
                    border-radius: 100px;
                    margin-bottom: 8px;
                }

                .xray-header h2 {
                    font-size: 24px;
                    font-weight: 700;
                    margin: 0;
                    background: linear-gradient(135deg, #fff, #a5b4fc);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }

                .xray-tabs {
                    display: flex;
                    padding: 0 32px;
                    gap: 24px;
                    border-bottom: 1px solid var(--color-divider);
                    background: var(--color-bg-elevated);
                }

                .tab-btn {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 16px 0;
                    background: none;
                    border: none;
                    font-size: 14px;
                    font-weight: 500;
                    color: var(--color-text-secondary);
                    cursor: pointer;
                    position: relative;
                    transition: color 0.2s;
                }

                .tab-btn:hover {
                    color: var(--color-text-primary);
                }

                .tab-btn.active {
                    color: #a855f7;
                }

                .tab-btn.active::after {
                    content: '';
                    position: absolute;
                    bottom: -1px;
                    left: 0;
                    width: 100%;
                    height: 2px;
                    background: #a855f7;
                }

                .xray-content {
                    flex: 1;
                    overflow-y: auto;
                    padding: 32px;
                }

                .text-body {
                    line-height: 1.7;
                    font-size: 16px;
                    color: var(--color-text-primary);
                }

                .section-block {
                    margin-bottom: 32px;
                }

                .section-block h3 {
                    font-size: 18px;
                    font-weight: 600;
                    margin-bottom: 16px;
                    color: var(--color-text-primary);
                    border-left: 3px solid #a855f7;
                    padding-left: 12px;
                }

                .key-points-list {
                    padding-left: 20px;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .key-points-list li {
                    color: var(--color-text-secondary);
                }
                
                .key-points-list li::marker {
                    color: #a855f7;
                }

                .grid-list {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                    gap: 16px;
                }

                .card-item {
                    background: var(--color-bg-tertiary);
                    padding: 16px;
                    border-radius: 12px;
                    border: 1px solid var(--color-divider);
                }

                .card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 8px;
                }

                .card-item h4 {
                    font-size: 16px;
                    font-weight: 600;
                    margin: 0 0 8px 0;
                    color: var(--color-text-primary);
                }

                .card-item p {
                    font-size: 14px;
                    color: var(--color-text-secondary);
                    line-height: 1.5;
                    margin: 0;
                }

                .importance-badge {
                    font-size: 10px;
                    text-transform: uppercase;
                    font-weight: 700;
                    padding: 2px 6px;
                    border-radius: 4px;
                }

                .importance-badge.main { background: rgba(59, 130, 246, 0.2); color: #60a5fa; }
                .importance-badge.secondary { background: rgba(16, 185, 129, 0.2); color: #34d399; }
                .importance-badge.minor { background: rgba(107, 114, 128, 0.2); color: #9ca3af; }

                .empty-state {
                    grid-column: 1 / -1;
                    text-align: center;
                    padding: 40px;
                    color: var(--color-text-tertiary);
                    font-style: italic;
                }

                @keyframes fadeIn {
                    from { opacity: 0; transform: scale(0.98); }
                    to { opacity: 1; transform: scale(1); }
                }

                .animate-fade-in {
                    animation: fadeIn 0.3s ease-out;
                }
            `}</style>
        </div>,
        document.body
    );
}
