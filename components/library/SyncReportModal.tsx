'use client';

interface SyncReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    results: {
        added: number;
        removed: number;
        errors: string[];
    } | null;
    isLoading: boolean;
}

export function SyncReportModal({ isOpen, onClose, results, isLoading }: SyncReportModalProps) {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header">
                    <h2 className="modal-title">Sincronización con Servidor</h2>
                    {!isLoading && (
                        <button className="close-btn" onClick={onClose}>×</button>
                    )}
                </div>

                <div className="modal-body">
                    {isLoading ? (
                        <div className="sync-loading">
                            <div className="spinner" />
                            <p>Sincronizando biblioteca...</p>
                        </div>
                    ) : results ? (
                        <div className="sync-results">
                            <div className="result-item success">
                                <span className="label">Añadidos:</span>
                                <span className="value">{results.added}</span>
                            </div>
                            <div className="result-item warning">
                                <span className="label">Eliminados:</span>
                                <span className="value">{results.removed}</span>
                            </div>

                            {results.errors.length > 0 && (
                                <div className="result-errors">
                                    <h3>Errores ({results.errors.length})</h3>
                                    <ul>
                                        {results.errors.map((err, i) => (
                                            <li key={i}>{err}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {results.added === 0 && results.removed === 0 && results.errors.length === 0 && (
                                <p className="empty-state">La biblioteca está actualizada.</p>
                            )}
                        </div>
                    ) : null}
                </div>

                {!isLoading && (
                    <div className="modal-actions">
                        <button className="btn btn-primary" onClick={onClose}>Aceptar</button>
                    </div>
                )}
            </div>

            <style jsx>{`
                .modal-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                    backdrop-filter: blur(4px);
                }

                .modal-content {
                    background: var(--color-bg-elevated);
                    border-radius: var(--radius-lg);
                    width: 90%;
                    max-width: 400px;
                    border: 1px solid var(--color-border);
                    box-shadow: var(--shadow-xl);
                    animation: slideUp 0.3s ease-out;
                }

                .modal-header {
                    padding: var(--space-4);
                    border-bottom: 1px solid var(--color-border);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .modal-title {
                    font-size: 1.25rem;
                    font-weight: 600;
                }

                .close-btn {
                    background: none;
                    border: none;
                    font-size: 1.5rem;
                    cursor: pointer;
                    color: var(--color-text-secondary);
                }

                .modal-body {
                    padding: var(--space-6);
                }

                .sync-loading {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: var(--space-4);
                    padding: var(--space-4) 0;
                }

                .spinner {
                    width: 32px;
                    height: 32px;
                    border: 3px solid var(--color-border);
                    border-top-color: var(--color-accent);
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }

                .result-item {
                    display: flex;
                    justify-content: space-between;
                    padding: var(--space-3);
                    border-bottom: 1px solid var(--color-border);
                }

                .result-item:last-child {
                    border-bottom: none;
                }

                .label {
                    color: var(--color-text-secondary);
                }

                .value {
                    font-weight: 600;
                }

                .result-errors {
                    margin-top: var(--space-4);
                    background: rgba(255, 0, 0, 0.1);
                    padding: var(--space-3);
                    border-radius: var(--radius-md);
                }

                .result-errors h3 {
                    color: #ef4444;
                    font-size: 0.9rem;
                    margin-bottom: var(--space-2);
                }

                .result-errors ul {
                    list-style: disc;
                    padding-left: var(--space-4);
                    font-size: 0.85rem;
                }

                .empty-state {
                    text-align: center;
                    color: var(--color-text-secondary);
                }

                .modal-actions {
                    padding: var(--space-4);
                    border-top: 1px solid var(--color-border);
                    display: flex;
                    justify-content: flex-end;
                }

                @keyframes spin {
                    to { transform: rotate(360deg); }
                }

                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}
