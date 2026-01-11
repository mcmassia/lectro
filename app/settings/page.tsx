'use client';

import { useState } from 'react';
import { useAppStore } from '@/stores/appStore';
import { db } from '@/lib/db';

export default function SettingsPage() {
    const {
        theme,
        setTheme,
        libraryPath,
        setLibraryPath,
        readerSettings,
        updateReaderSettings,
        dailyReadingGoal,
        setDailyReadingGoal,
    } = useAppStore();

    const [showClearConfirm, setShowClearConfirm] = useState(false);

    const handleClearData = async () => {
        try {
            await db.books.clear();
            await db.annotations.clear();
            await db.readingSessions.clear();
            await db.vectorChunks.clear();
            await db.xrayData.clear();
            await db.summaries.clear();
            localStorage.clear();
            window.location.reload();
        } catch (error) {
            console.error('Failed to clear data:', error);
        }
    };

    const handleExportAnnotations = async () => {
        try {
            const annotations = await db.annotations.toArray();
            const books = await db.books.toArray();

            const markdown = annotations.map(ann => {
                const book = books.find(b => b.id === ann.bookId);
                return `## ${book?.title || 'Libro desconocido'}

> ${ann.text}

${ann.note ? `**Nota:** ${ann.note}` : ''}

---
`;
            }).join('\n');

            const blob = new Blob([markdown], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'lectro-annotations.md';
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Failed to export:', error);
        }
    };

    return (
        <div className="page-container animate-fade-in">
            <div className="page-header">
                <h1 className="page-title">Ajustes</h1>
                <p className="page-subtitle">Personaliza tu experiencia de lectura</p>
            </div>

            <div className="settings-grid">
                {/* Appearance */}
                <section className="settings-section card">
                    <h2 className="section-title">Apariencia</h2>

                    <div className="setting-item">
                        <div className="setting-info">
                            <h3>Tema</h3>
                            <p>Selecciona el tema de la aplicación</p>
                        </div>
                        <div className="theme-buttons">
                            {(['light', 'dark', 'system'] as const).map((t) => (
                                <button
                                    key={t}
                                    className={`theme-btn ${theme === t ? 'active' : ''}`}
                                    onClick={() => setTheme(t)}
                                >
                                    {t === 'light' ? '☀️ Claro' : t === 'dark' ? '🌙 Oscuro' : '💻 Sistema'}
                                </button>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Library */}
                <section className="settings-section card">
                    <h2 className="section-title">Biblioteca</h2>

                    <div className="setting-item">
                        <div className="setting-info">
                            <h3>Carpeta de biblioteca</h3>
                            <p>Ubicación donde se guardan tus libros</p>
                        </div>
                        <div className="setting-control">
                            <input
                                type="text"
                                className="input"
                                value={libraryPath || 'No configurada'}
                                readOnly
                                style={{ maxWidth: '300px' }}
                            />
                            <button className="btn btn-secondary" onClick={async () => {
                                try {
                                    // @ts-ignore - File System Access API
                                    const dirHandle = await window.showDirectoryPicker();
                                    if (dirHandle) {
                                        setLibraryPath(dirHandle.name);

                                        // Save handle and sync
                                        const { updateSettings } = await import('@/lib/db');
                                        const { syncLibraryWithFolder } = await import('@/lib/fileSystem');

                                        await updateSettings({
                                            libraryPath: dirHandle.name,
                                            libraryHandle: dirHandle
                                        });

                                        const count = await syncLibraryWithFolder(dirHandle);
                                        if (count > 0) {
                                            alert(`Se importaron ${count} libros de la carpeta seleccionada.`);
                                            // Refresh books if needed
                                            window.location.reload();
                                        }
                                    }
                                } catch (err) {
                                    if ((err as Error).name !== 'AbortError') {
                                        console.error('Error selecting folder:', err);
                                        alert('Error al seleccionar carpeta: ' + (err as Error).message);
                                    }
                                }
                            }}>
                                Cambiar
                            </button>
                        </div>
                    </div>
                </section>

                {/* Reading */}
                <section className="settings-section card">
                    <h2 className="section-title">Lectura</h2>

                    <div className="setting-item">
                        <div className="setting-info">
                            <h3>Meta diaria</h3>
                            <p>Páginas que deseas leer cada día</p>
                        </div>
                        <div className="goal-control">
                            <input
                                type="range"
                                min="5"
                                max="100"
                                step="5"
                                value={dailyReadingGoal}
                                onChange={(e) => setDailyReadingGoal(Number(e.target.value))}
                            />
                            <span className="goal-value">{dailyReadingGoal} páginas</span>
                        </div>
                    </div>

                    <div className="setting-item">
                        <div className="setting-info">
                            <h3>Fuente predeterminada</h3>
                            <p>Fuente para la lectura de libros</p>
                        </div>
                        <select
                            className="input"
                            value={readerSettings.fontFamily}
                            onChange={(e) => updateReaderSettings({ fontFamily: e.target.value })}
                            style={{ maxWidth: '200px' }}
                        >
                            <option value="Georgia, serif">Georgia</option>
                            <option value="'Times New Roman', serif">Times New Roman</option>
                            <option value="'Merriweather', serif">Merriweather</option>
                            <option value="'Inter', sans-serif">Inter</option>
                            <option value="'OpenDyslexic', sans-serif">OpenDyslexic</option>
                        </select>
                    </div>

                    <div className="setting-item">
                        <div className="setting-info">
                            <h3>Tamaño de fuente</h3>
                            <p>Tamaño base para la lectura</p>
                        </div>
                        <div className="size-control">
                            <button
                                className="btn btn-icon btn-secondary"
                                onClick={() => updateReaderSettings({ fontSize: Math.max(12, readerSettings.fontSize - 1) })}
                            >
                                −
                            </button>
                            <span>{readerSettings.fontSize}px</span>
                            <button
                                className="btn btn-icon btn-secondary"
                                onClick={() => updateReaderSettings({ fontSize: Math.min(28, readerSettings.fontSize + 1) })}
                            >
                                +
                            </button>
                        </div>
                    </div>
                </section>

                {/* Data */}
                <section className="settings-section card">
                    <h2 className="section-title">Datos</h2>

                    <div className="setting-item">
                        <div className="setting-info">
                            <h3>Exportar anotaciones</h3>
                            <p>Descarga todas tus notas y subrayados en Markdown</p>
                        </div>
                        <button className="btn btn-secondary" onClick={handleExportAnnotations}>
                            Exportar
                        </button>
                    </div>

                    <div className="setting-item danger">
                        <div className="setting-info">
                            <h3>Borrar todos los datos</h3>
                            <p>Elimina todos los libros, anotaciones y configuración</p>
                        </div>
                        {showClearConfirm ? (
                            <div className="confirm-buttons">
                                <button className="btn btn-ghost" onClick={() => setShowClearConfirm(false)}>
                                    Cancelar
                                </button>
                                <button className="btn btn-danger" onClick={handleClearData}>
                                    Confirmar
                                </button>
                            </div>
                        ) : (
                            <button className="btn btn-secondary" onClick={() => setShowClearConfirm(true)}>
                                Borrar
                            </button>
                        )}
                    </div>
                </section>

                {/* About */}
                <section className="settings-section card">
                    <h2 className="section-title">Acerca de</h2>

                    <div className="about-info">
                        <div className="app-logo">
                            <svg viewBox="0 0 40 40" width="40" height="40">
                                <defs>
                                    <linearGradient id="logoGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" stopColor="#007AFF" />
                                        <stop offset="100%" stopColor="#5856D6" />
                                    </linearGradient>
                                </defs>
                                <rect width="40" height="40" rx="10" fill="url(#logoGrad2)" />
                                <text x="50%" y="55%" dominantBaseline="middle" textAnchor="middle" fill="white" fontSize="20" fontWeight="700">L</text>
                            </svg>
                            <div>
                                <h3>Lectro</h3>
                                <p>Versión 1.0.0</p>
                            </div>
                        </div>
                        <p className="about-description">
                            Plataforma de lectura digital con inteligencia artificial para gestión de conocimiento.
                        </p>
                    </div>
                </section>
            </div>

            <style jsx>{`
        .settings-grid {
          display: flex;
          flex-direction: column;
          gap: var(--space-6);
          max-width: 800px;
        }

        .settings-section {
          padding: var(--space-6);
        }

        .section-title {
          font-size: var(--text-lg);
          font-weight: 600;
          margin-bottom: var(--space-6);
          color: var(--color-text-primary);
        }

        .setting-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--space-4) 0;
          border-bottom: 1px solid var(--color-divider);
        }

        .setting-item:last-child {
          border-bottom: none;
        }

        .setting-info h3 {
          font-size: var(--text-base);
          font-weight: 500;
          color: var(--color-text-primary);
          margin-bottom: var(--space-1);
        }

        .setting-info p {
          font-size: var(--text-sm);
          color: var(--color-text-secondary);
        }

        .setting-control {
          display: flex;
          gap: var(--space-2);
          align-items: center;
        }

        .theme-buttons {
          display: flex;
          gap: var(--space-2);
        }

        .theme-btn {
          padding: var(--space-2) var(--space-3);
          font-size: var(--text-sm);
          background: var(--color-bg-tertiary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .theme-btn.active {
          background: var(--color-accent-subtle);
          border-color: var(--color-accent);
          color: var(--color-accent);
        }

        .goal-control {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }

        .goal-control input {
          width: 150px;
          accent-color: var(--color-accent);
        }

        .goal-value {
          font-size: var(--text-sm);
          color: var(--color-text-secondary);
          min-width: 80px;
        }

        .size-control {
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }

        .size-control span {
          min-width: 50px;
          text-align: center;
          font-weight: 500;
        }

        .setting-item.danger .setting-info h3 {
          color: var(--color-error);
        }

        .btn-danger {
          background: var(--color-error);
          color: white;
        }

        .confirm-buttons {
          display: flex;
          gap: var(--space-2);
        }

        .about-info {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }

        .app-logo {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }

        .app-logo h3 {
          font-size: var(--text-lg);
          font-weight: 600;
        }

        .app-logo p {
          font-size: var(--text-sm);
          color: var(--color-text-tertiary);
        }

        .about-description {
          font-size: var(--text-sm);
          color: var(--color-text-secondary);
          line-height: 1.6;
        }
      `}</style>
        </div>
    );
}
