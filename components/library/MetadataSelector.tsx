import { MetadataResult } from '@/lib/metadata';

interface MetadataSelectorProps {
    results: MetadataResult[];
    onSelect: (result: MetadataResult) => void;
    onCancel: () => void;
}

export function MetadataSelector({ results, onSelect, onCancel }: MetadataSelectorProps) {
    return (
        <div className="metadata-selector">
            <div className="selector-header">
                <h3>Select Metadata</h3>
                <button className="close-btn" onClick={onCancel}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>
            </div>

            <div className="results-list">
                {results.map((result) => (
                    <div key={`${result.source}-${result.id}`} className="result-item">
                        <div className="result-cover-wrapper">
                            {result.cover ? (
                                <img src={result.cover} alt={result.title} className="result-cover" />
                            ) : (
                                <div className="result-cover-placeholder">
                                    <span>{result.title[0]}</span>
                                </div>
                            )}
                            <span className="source-badge">{result.source}</span>
                        </div>

                        <div className="result-info">
                            <h4 className="result-title">{result.title}</h4>
                            <div className="result-meta">
                                <span className="result-author">{result.author}</span>
                                {result.publishedDate && (
                                    <span className="result-year"> • {result.publishedDate.substring(0, 4)}</span>
                                )}
                                {result.publisher && (
                                    <span className="result-publisher"> • {result.publisher}</span>
                                )}
                            </div>
                            {result.description && (
                                <p className="result-description">{result.description.substring(0, 150)}...</p>
                            )}
                            <button
                                className="btn-select"
                                onClick={() => onSelect(result)}
                            >
                                Select
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <style jsx>{`
                .metadata-selector {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    max-height: 600px;
                    background: #1a1b1e;
                    border-radius: var(--radius-lg);
                    border: 1px solid rgba(255,255,255,0.1);
                }

                .selector-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: var(--space-4);
                    border-bottom: 1px solid rgba(255,255,255,0.1);
                }

                .selector-header h3 {
                    margin: 0;
                    font-size: var(--text-lg);
                    font-weight: 600;
                    color: #fff;
                }

                .close-btn {
                    background: transparent;
                    border: none;
                    color: rgba(255,255,255,0.5);
                    cursor: pointer;
                    padding: 4px;
                    border-radius: 50%;
                }

                .close-btn:hover {
                    background: rgba(255,255,255,0.1);
                    color: #fff;
                }

                .results-list {
                    flex: 1;
                    overflow-y: auto;
                    padding: var(--space-4);
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-4);
                }

                .result-item {
                    display: flex;
                    gap: var(--space-4);
                    padding: var(--space-4);
                    background: rgba(255,255,255,0.05);
                    border-radius: var(--radius-md);
                    transition: background 0.2s;
                }

                .result-item:hover {
                    background: rgba(255,255,255,0.08);
                }

                .result-cover-wrapper {
                    position: relative;
                    width: 60px;
                    height: 90px;
                    flex-shrink: 0;
                    border-radius: var(--radius-sm);
                    overflow: hidden;
                }

                .result-cover {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                .result-cover-placeholder {
                    width: 100%;
                    height: 100%;
                    background: var(--gradient-cool);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 700;
                    color: rgba(255,255,255,0.5);
                }

                .source-badge {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    background: rgba(0,0,0,0.7);
                    color: #fff;
                    font-size: 8px;
                    text-align: center;
                    padding: 2px;
                }

                .result-info {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .result-title {
                    margin: 0;
                    font-size: var(--text-base);
                    font-weight: 600;
                    color: #fff;
                }

                .result-meta {
                    font-size: var(--text-xs);
                    color: rgba(255,255,255,0.6);
                }

                .result-description {
                    font-size: var(--text-xs);
                    color: rgba(255,255,255,0.5);
                    margin: 4px 0 0 0;
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }

                .btn-select {
                    margin-top: auto;
                    align-self: flex-start;
                    background: rgba(255,255,255,0.1);
                    border: none;
                    color: #fff;
                    padding: 4px 12px;
                    border-radius: var(--radius-full);
                    font-size: var(--text-xs);
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .btn-select:hover {
                    background: var(--color-accent);
                    color: white;
                }
            `}</style>
        </div>
    );
}
