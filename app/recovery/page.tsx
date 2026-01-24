'use client';

import { useState, useEffect } from 'react';
import { getAllBooks } from '@/lib/db';
import { pushLocalData } from '@/lib/sync';
import Link from 'next/link';

export default function RecoveryPage() {
    const [localCount, setLocalCount] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [status, setStatus] = useState<string>('');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        checkLocalData();
    }, []);

    const checkLocalData = async () => {
        try {
            const books = await getAllBooks();
            setLocalCount(books.length);
        } catch (e) {
            setError('Error leyendo base de datos local: ' + (e as any).message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRestore = async () => {
        if (!confirm('Esto enviará TODOS tus libros locales al servidor, sobrescribiendo lo que haya allí. ¿Continuar?')) return;

        setStatus('Iniciando restauración... Por favor espera y NO cierres esta página.');
        setError(null);

        try {
            await pushLocalData();
            setStatus('✅ Restauración completada con éxito. Verifica "lectro_data.json" en el servidor.');
            alert('Restauración completada. Ahora puedes volver a la biblioteca.');
        } catch (e) {
            console.error(e);
            setError('Fallo la restauración: ' + (e as any).message);
            setStatus('');
        }
    };

    return (
        <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', fontFamily: 'system-ui' }}>
            <h1 style={{ color: '#ef4444' }}>🛠️ Panel de Recuperación de Emergencia</h1>

            <div style={{ background: '#1e293b', color: 'white', padding: '20px', borderRadius: '8px', marginTop: '20px' }}>
                <h2>Estado de Base de Datos Local (Tu Navegador)</h2>
                {isLoading ? (
                    <p>Escaneando libros...</p>
                ) : (
                    <div>
                        <p style={{ fontSize: '24px', fontWeight: 'bold' }}>
                            {localCount !== null ? `${localCount} libros encontrados` : 'Error de lectura'}
                        </p>
                        {localCount && localCount < 100 && (
                            <p style={{ color: '#fca5a5' }}>⚠ Advertencia: Pocos libros locales encontrados. ¿Quizás estás en otro navegador?</p>
                        )}
                        {localCount && localCount > 1000 && (
                            <p style={{ color: '#86efac' }}>✅ Parece que tienes tu biblioteca intacta aquí.</p>
                        )}
                    </div>
                )}
            </div>

            {error && (
                <div style={{ background: '#fee2e2', color: '#991b1b', padding: '15px', borderRadius: '8px', marginTop: '20px' }}>
                    <strong>Error:</strong> {error}
                </div>
            )}

            {status && (
                <div style={{ background: '#dbeafe', color: '#1e40af', padding: '15px', borderRadius: '8px', marginTop: '20px' }}>
                    {status}
                </div>
            )}

            <div style={{ marginTop: '30px', display: 'flex', gap: '20px' }}>
                <button
                    onClick={handleRestore}
                    disabled={isLoading || localCount === 0}
                    style={{
                        background: '#2563eb',
                        color: 'white',
                        border: 'none',
                        padding: '12px 24px',
                        borderRadius: '6px',
                        fontSize: '16px',
                        cursor: 'pointer',
                        opacity: isLoading ? 0.5 : 1
                    }}
                >
                    🔄 Restaurar Servidor desde Local
                </button>

                <Link href="/library" style={{ display: 'inline-block', padding: '12px 24px', color: '#64748b', textDecoration: 'none' }}>
                    Cancelar y Volver
                </Link>
            </div>

            <div style={{ marginTop: '50px', borderTop: '1px solid #ddd', paddingTop: '20px', color: '#666' }}>
                <h3>¿Qué ha pasado?</h3>
                <p>Es posible que un error de sincronización haya borrado el archivo de datos del servidor. Afortunadamente, tus libros deberían seguir seguros en la base de datos de tu navegador (IndexedDB).</p>
                <p>Esta herramienta fuerza el envío de tus datos locales al servidor para repararlo.</p>
            </div>
        </div>
    );
}
