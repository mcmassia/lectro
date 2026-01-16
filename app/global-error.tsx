'use client';

import { useEffect } from 'react';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <html>
            <body>
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '100vh',
                    padding: '20px',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    lineHeight: '1.5',
                    color: '#333',
                    backgroundColor: '#fff'
                }}>
                    <div style={{ maxWidth: '600px', width: '100%' }}>
                        <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px', color: '#e00' }}>
                            Algo salió mal
                        </h2>
                        <p style={{ marginBottom: '16px' }}>
                            Se ha producido un error crítico en la aplicación.
                        </p>

                        <div style={{
                            padding: '16px',
                            backgroundColor: '#f5f5f5',
                            borderRadius: '8px',
                            overflow: 'auto',
                            marginBottom: '24px',
                            border: '1px solid #ddd'
                        }}>
                            <p style={{ fontWeight: 'bold', marginBottom: '8px' }}>Error:</p>
                            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '12px', fontFamily: 'monospace' }}>
                                {error.message}
                            </pre>
                            {error.stack && (
                                <details style={{ marginTop: '12px' }}>
                                    <summary style={{ cursor: 'pointer', color: '#0066cc' }}>Ver detalles técnicos</summary>
                                    <pre style={{ marginTop: '8px', whiteSpace: 'pre-wrap', fontSize: '11px', color: '#666' }}>
                                        {error.stack}
                                    </pre>
                                </details>
                            )}
                        </div>

                        <button
                            onClick={() => reset()}
                            style={{
                                padding: '10px 20px',
                                backgroundColor: '#007aff',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '16px',
                                cursor: 'pointer',
                                fontWeight: 500
                            }}
                        >
                            Intentar recargar
                        </button>
                    </div>
                </div>
            </body>
        </html>
    );
}
