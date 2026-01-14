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
    progressLogs?: string[];
}

export function SyncReportModal({ isOpen, onClose, results, isLoading, progressLogs = [] }: SyncReportModalProps) {
    if (!isOpen) return null;

    // Auto-scroll to bottom of logs
    // ...

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header">
                    <h2 className="modal-title">Sincronización con Servidor</h2>
                </div>

                <div className="modal-body">
                    {isLoading ? (
                        <div className="sync-loading">
                            <div className="spinner-container">
                                <div className="spinner" />
                                <p>Sincronizando biblioteca...</p>
                            </div>
                            <div className="logs-container">
                                {progressLogs.map((log, i) => (
                                    <div key={i} className="log-entry">{log}</div>
                                ))}
                                {progressLogs.length === 0 && <div className="log-entry placeholder">Iniciando...</div>}
                            </div>
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
                    gap: var(--space-4);
                }

                .spinner-container {
                    display: flex;
                    align-items: center;
                    gap: var(--space-3);
                    justify-content: center;
                    padding-bottom: var(--space-2);
                }

                .spinner {
                    width: 24px;
                    height: 24px;
                    border: 2px solid var(--color-border);
                    border-top-color: var(--color-accent);
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }
                
                .logs-container {
                    background: var(--color-bg-secondary);
                    border-radius: var(--radius-md);
                    padding: var(--space-3);
                    height: 150px;
                    overflow-y: auto;
                    font-family: monospace;
                    font-size: 0.8rem;
                    border: 1px solid var(--color-border);
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                
                .log-entry {
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    color: var(--color-text-secondary);
                }
                
                .log-entry:last-child {
                    color: var(--color-text-primary);
                    font-weight: 500;
                }

                .log-entry.placeholder {
                    color: var(--color-text-tertiary);
                    font-style: italic;
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
