'use client';

import { useState, useEffect } from 'react';
import { useAppStore, useReaderStore } from '@/stores/appStore';
import { Book, Annotation, getXRayData, XRayData, HighlightColor } from '@/lib/db';
import { TocItem } from './EpubReader';

interface ReaderSidebarProps {
    book: Book;
    annotations: Annotation[];
    toc?: TocItem[];
    onAnnotationClick?: (cfi: string) => void;
    onTocItemClick?: (href: string) => void;
    onEditAnnotation?: (id: string, updates: { note?: string; color?: HighlightColor }) => void;
    onDeleteAnnotation?: (id: string) => void;
}

export function ReaderSidebar({ book, annotations, toc = [], onAnnotationClick, onTocItemClick, onEditAnnotation, onDeleteAnnotation }: ReaderSidebarProps) {
    const { readerSidebarTab, setReaderSidebarTab, readerSettings, updateReaderSettings } = useAppStore();
    const { setCurrentCfi } = useReaderStore();
    const [xrayData, setXrayData] = useState<XRayData | null>(null);
    const [isGeneratingXray, setIsGeneratingXray] = useState(false);

    // Edit annotation state
    const [editingAnnotation, setEditingAnnotation] = useState<Annotation | null>(null);
    const [editNote, setEditNote] = useState('');
    const [editColor, setEditColor] = useState<HighlightColor>('yellow');
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

    // Load X-Ray data
    useEffect(() => {
        async function loadXRay() {
            const data = await getXRayData(book.id);
            if (data) {
                setXrayData(data);
            }
        }
        loadXRay();
    }, [book.id]);

    const handleGenerateXRay = async () => {
        if (!book || !book.fileBlob) {
            console.error('Book content not available');
            return;
        }

        setIsGeneratingXray(true);
        try {
            // Import epubjs dynamically
            const ePub = (await import('epubjs')).default;
            const arrayBuffer = await book.fileBlob.arrayBuffer();
            const bookInstance = ePub(arrayBuffer);

            await bookInstance.ready;

            // Extract text from the first few chapters (limit to avoid too much data)
            // We want enough context for a good X-Ray. 
            // Let's iterate spine items and extract text until we hit a limit or finish.
            let fullText = '';
            // @ts-ignore
            const spine = bookInstance.spine;
            const sections: any[] = [];
            // Use the public API to iterate sections ensures we get initialized Section objects
            spine.each((section: any) => sections.push(section));

            const limit = 60000; // Character limit for AI context

            // Use simple iteration for now, assuming standard spine
            // Ideally we'd use the same robust extraction logic as indexer, but let's keep it simple for MVP client-side

            console.log(`X-Ray: Processing ${sections.length} sections`);

            for (const item of sections) {
                if (fullText.length >= limit) break;

                try {
                    const doc = await item.load(bookInstance.load.bind(bookInstance));

                    let text = '';
                    if (doc instanceof Document) {
                        // Prefer textContent for robustness, it works even if not rendered
                        const root = doc.body || doc.documentElement;
                        if (root && root.textContent) {
                            text = root.textContent;
                        }
                    } else if (typeof doc === 'string') {
                        // Sometimes it returns raw string
                        const tempDiv = document.createElement('div');
                        tempDiv.innerHTML = doc;
                        text = tempDiv.textContent || '';
                    }

                    // Clean up text
                    text = text.replace(/\s+/g, ' ').trim();

                    if (text) {
                        fullText += text + '\n\n';
                    } else {
                        console.warn(`X-Ray: No text found in ${item.href}`);
                    }

                    item.unload();
                } catch (e) {
                    console.error('Error reading chapter for X-Ray:', e);
                }
            }

            bookInstance.destroy();

            if (!fullText) {
                console.error('X-Ray: Full text is empty after processing sections');
                throw new Error('Could not extract text from book');
            }

            // Call server action
            const { generateXRayAction } = await import('@/app/actions/ai');
            const result = await generateXRayAction(fullText, book.title);

            if (result.success && result.data) {
                const { saveXRayData } = await import('@/lib/db');
                // Map AI result to DB schema (add empty mentions)
                const mappedData: XRayData = {
                    id: crypto.randomUUID(),
                    bookId: book.id,
                    generatedAt: new Date(),
                    characters: result.data.characters.map((c: any) => ({ ...c, mentions: [] })),
                    places: result.data.places.map((p: any) => ({ ...p, mentions: [] })),
                    terms: result.data.terms.map((t: any) => ({ ...t, mentions: [] }))
                };

                await saveXRayData(mappedData);
                setXrayData(mappedData);
            } else {
                console.error('X-Ray generation failed:', result.error);
                // Optionally show error toast
            }

        } catch (error) {
            console.error('Failed to generate X-Ray:', error);
        } finally {
            setIsGeneratingXray(false);
        }
    };

    const handleStartEdit = (annotation: Annotation, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingAnnotation(annotation);
        setEditNote(annotation.note || '');
        setEditColor(annotation.color);
    };

    const handleSaveEdit = () => {
        if (editingAnnotation && onEditAnnotation) {
            onEditAnnotation(editingAnnotation.id, {
                note: editNote || undefined,
                color: editColor,
            });
        }
        setEditingAnnotation(null);
        setEditNote('');
    };

    const handleCancelEdit = () => {
        setEditingAnnotation(null);
        setEditNote('');
    };

    const handleDeleteClick = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setDeleteConfirmId(id);
    };

    const handleConfirmDelete = () => {
        if (deleteConfirmId && onDeleteAnnotation) {
            onDeleteAnnotation(deleteConfirmId);
        }
        setDeleteConfirmId(null);
    };

    const handleCancelDelete = () => {
        setDeleteConfirmId(null);
    };

    return (
        <aside className="reader-sidebar">
            <div className="reader-sidebar-header">
                <div className="reader-sidebar-tabs">
                    <button
                        className={`reader-sidebar-tab ${readerSidebarTab === 'toc' ? 'active' : ''}`}
                        onClick={() => setReaderSidebarTab('toc')}
                    >
                        Índice
                    </button>
                    <button
                        className={`reader-sidebar-tab ${readerSidebarTab === 'annotations' ? 'active' : ''}`}
                        onClick={() => setReaderSidebarTab('annotations')}
                    >
                        Notas
                    </button>
                    <button
                        className={`reader-sidebar-tab ${readerSidebarTab === 'xray' ? 'active' : ''}`}
                        onClick={() => setReaderSidebarTab('xray')}
                    >
                        X-Ray
                    </button>
                    <button
                        className={`reader-sidebar-tab ${readerSidebarTab === 'settings' ? 'active' : ''}`}
                        onClick={() => setReaderSidebarTab('settings')}
                    >
                        Ajustes
                    </button>
                </div>
            </div>

            <div className="reader-sidebar-content">
                {/* Table of Contents */}
                {readerSidebarTab === 'toc' && (
                    <div className="toc-content">
                        {toc.length === 0 ? (
                            <p className="empty-state-text">
                                Cargando tabla de contenidos...
                            </p>
                        ) : (
                            <div className="toc-list">
                                {toc.map((item, index) => (
                                    <div key={index} className="toc-item-container">
                                        <button
                                            className="toc-item"
                                            onClick={() => onTocItemClick?.(item.href)}
                                        >
                                            {item.label}
                                        </button>
                                        {item.subitems && item.subitems.length > 0 && (
                                            <div className="toc-subitems">
                                                {item.subitems.map((subitem, subIndex) => (
                                                    <button
                                                        key={subIndex}
                                                        className="toc-item toc-subitem"
                                                        onClick={() => onTocItemClick?.(subitem.href)}
                                                    >
                                                        {subitem.label}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Annotations */}
                {readerSidebarTab === 'annotations' && (
                    <div className="annotations-content">
                        {annotations.length === 0 ? (
                            <div className="empty-state">
                                <p className="empty-state-text">
                                    Selecciona texto en el libro para crear anotaciones
                                </p>
                            </div>
                        ) : (
                            <div className="annotation-list">
                                {annotations.map((annotation) => (
                                    <div
                                        key={annotation.id}
                                        className={`annotation-item ${deleteConfirmId === annotation.id ? 'deleting' : ''}`}
                                        onClick={() => onAnnotationClick?.(annotation.cfi)}
                                    >
                                        <div
                                            className="annotation-color"
                                            style={{ backgroundColor: getColorValue(annotation.color) }}
                                        />
                                        <div className="annotation-content">
                                            <div className="annotation-context">
                                                {annotation.chapterTitle && (
                                                    <span className="context-chapter">{annotation.chapterTitle}</span>
                                                )}
                                                {annotation.pageNumber && (
                                                    <span className="context-page">Pág. {annotation.pageNumber}</span>
                                                )}
                                            </div>
                                            <p className="annotation-text">&quot;{annotation.text}&quot;</p>
                                            {annotation.note && (
                                                <p className="annotation-note">{annotation.note}</p>
                                            )}
                                        </div>
                                        <div className="annotation-actions">
                                            <button
                                                className="action-btn edit-btn"
                                                onClick={(e) => handleStartEdit(annotation, e)}
                                                title="Editar anotación"
                                            >
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                </svg>
                                            </button>
                                            <button
                                                className="action-btn delete-btn"
                                                onClick={(e) => handleDeleteClick(annotation.id, e)}
                                                title="Eliminar anotación"
                                            >
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                                                    <polyline points="3 6 5 6 21 6" />
                                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* X-Ray */}
                {readerSidebarTab === 'xray' && (
                    <div className="xray-content">
                        {xrayData ? (
                            <div className="xray-sections">
                                {xrayData.characters.length > 0 && (
                                    <div className="xray-section">
                                        <h4 className="xray-section-title">Personajes</h4>
                                        {xrayData.characters.map((char, i) => (
                                            <div key={i} className="xray-item">
                                                <span className="xray-name">{char.name}</span>
                                                <p className="xray-description">{char.description}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {xrayData.places.length > 0 && (
                                    <div className="xray-section">
                                        <h4 className="xray-section-title">Lugares</h4>
                                        {xrayData.places.map((place, i) => (
                                            <div key={i} className="xray-item">
                                                <span className="xray-name">{place.name}</span>
                                                <p className="xray-description">{place.description}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {xrayData.terms.length > 0 && (
                                    <div className="xray-section">
                                        <h4 className="xray-section-title">Términos</h4>
                                        {xrayData.terms.map((term, i) => (
                                            <div key={i} className="xray-item">
                                                <span className="xray-name">{term.name}</span>
                                                <p className="xray-description">{term.description}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="empty-state">
                                <p className="empty-state-text">
                                    X-Ray analiza personajes, lugares y términos del libro
                                </p>
                                <button
                                    className="btn btn-primary"
                                    onClick={handleGenerateXRay}
                                    disabled={isGeneratingXray}
                                >
                                    {isGeneratingXray ? 'Generando...' : 'Generar X-Ray'}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Settings */}
                {readerSidebarTab === 'settings' && (
                    <div className="settings-content">
                        <div className="settings-section">
                            <label className="settings-label">Fuente</label>
                            <select
                                className="input"
                                value={readerSettings.fontFamily}
                                onChange={(e) => updateReaderSettings({ fontFamily: e.target.value })}
                            >
                                <option value="Georgia, serif">Georgia</option>
                                <option value="'Times New Roman', serif">Times New Roman</option>
                                <option value="'Palatino Linotype', serif">Palatino</option>
                                <option value="'Merriweather', serif">Merriweather</option>
                                <option value="'Inter', sans-serif">Inter</option>
                                <option value="'Arial', sans-serif">Arial</option>
                                <option value="'OpenDyslexic', sans-serif">OpenDyslexic</option>
                            </select>
                        </div>

                        <div className="settings-section">
                            <label className="settings-label">Tamaño de fuente: {readerSettings.fontSize}px</label>
                            <input
                                type="range"
                                min="12"
                                max="28"
                                value={readerSettings.fontSize}
                                onChange={(e) => updateReaderSettings({ fontSize: Number(e.target.value) })}
                                className="range-input"
                            />
                        </div>

                        <div className="settings-section">
                            <label className="settings-label">Altura de línea: {readerSettings.lineHeight}</label>
                            <input
                                type="range"
                                min="1.2"
                                max="2.5"
                                step="0.1"
                                value={readerSettings.lineHeight}
                                onChange={(e) => updateReaderSettings({ lineHeight: Number(e.target.value) })}
                                className="range-input"
                            />
                        </div>

                        <div className="settings-section">
                            <label className="settings-label">Espaciado entre letras: {readerSettings.letterSpacing}em</label>
                            <input
                                type="range"
                                min="-0.05"
                                max="0.15"
                                step="0.01"
                                value={readerSettings.letterSpacing}
                                onChange={(e) => updateReaderSettings({ letterSpacing: Number(e.target.value) })}
                                className="range-input"
                            />
                        </div>

                        <div className="settings-section">
                            <label className="settings-label">Margen horizontal: {readerSettings.marginHorizontal}px</label>
                            <input
                                type="range"
                                min="20"
                                max="120"
                                value={readerSettings.marginHorizontal}
                                onChange={(e) => updateReaderSettings({ marginHorizontal: Number(e.target.value) })}
                                className="range-input"
                            />
                        </div>

                        <div className="settings-section">
                            <label className="settings-label">Tema</label>
                            <div className="theme-buttons">
                                {(['light', 'sepia', 'dark'] as const).map((theme) => (
                                    <button
                                        key={theme}
                                        className={`theme-btn ${theme} ${readerSettings.theme === theme ? 'active' : ''}`}
                                        onClick={() => updateReaderSettings({ theme })}
                                    >
                                        {theme === 'light' ? 'Claro' : theme === 'sepia' ? 'Sepia' : 'Oscuro'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="settings-section">
                            <label className="settings-label">Alineación</label>
                            <div className="align-buttons">
                                <button
                                    className={`align-btn ${readerSettings.textAlign === 'left' ? 'active' : ''}`}
                                    onClick={() => updateReaderSettings({ textAlign: 'left' })}
                                >
                                    Izquierda
                                </button>
                                <button
                                    className={`align-btn ${readerSettings.textAlign === 'justify' ? 'active' : ''}`}
                                    onClick={() => updateReaderSettings({ textAlign: 'justify' })}
                                >
                                    Justificado
                                </button>
                            </div>
                        </div>

                        <div className="settings-section">
                            <label className="settings-toggle">
                                <input
                                    type="checkbox"
                                    checked={readerSettings.scrollMode}
                                    onChange={(e) => updateReaderSettings({ scrollMode: e.target.checked })}
                                />
                                <span>Modo scroll</span>
                            </label>
                        </div>
                    </div>
                )}
            </div>

            {/* Delete Confirmation Modal - outside scrollable content */}
            {deleteConfirmId && (
                <div className="sidebar-modal-overlay" onClick={handleCancelDelete}>
                    <div className="sidebar-modal-content delete-modal" onClick={(e) => e.stopPropagation()}>
                        <h4>¿Eliminar anotación?</h4>
                        <p>Esta acción no se puede deshacer.</p>
                        <div className="modal-actions">
                            <button className="btn btn-ghost btn-sm" onClick={handleCancelDelete}>
                                Cancelar
                            </button>
                            <button className="btn btn-danger btn-sm" onClick={handleConfirmDelete}>
                                Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal - outside scrollable content */}
            {editingAnnotation && (
                <div className="sidebar-modal-overlay" onClick={handleCancelEdit}>
                    <div className="sidebar-modal-content edit-modal" onClick={(e) => e.stopPropagation()}>
                        <h4>Editar anotación</h4>
                        <div className="edit-text-preview">
                            &quot;{editingAnnotation.text.substring(0, 100)}{editingAnnotation.text.length > 100 ? '...' : ''}&quot;
                        </div>
                        <div className="edit-color-section">
                            <label>Color:</label>
                            <div className="color-buttons">
                                {(['yellow', 'green', 'blue', 'pink', 'orange'] as const).map((color) => (
                                    <button
                                        key={color}
                                        className={`color-btn ${editColor === color ? 'selected' : ''}`}
                                        style={{ backgroundColor: getColorValue(color) }}
                                        onClick={() => setEditColor(color)}
                                    />
                                ))}
                            </div>
                        </div>
                        <div className="edit-note-section">
                            <label>Nota:</label>
                            <textarea
                                className="edit-note-input"
                                value={editNote}
                                onChange={(e) => setEditNote(e.target.value)}
                                placeholder="Añade una nota..."
                                rows={3}
                            />
                        </div>
                        <div className="modal-actions">
                            <button className="btn btn-ghost btn-sm" onClick={handleCancelEdit}>
                                Cancelar
                            </button>
                            <button className="btn btn-primary btn-sm" onClick={handleSaveEdit}>
                                Guardar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
        .reader-sidebar {
          position: fixed;
          top: 0;
          right: 0;
          width: 320px;
          height: 100vh;
          background: var(--color-bg-secondary);
          border-left: 1px solid var(--color-border);
          display: flex;
          flex-direction: column;
          z-index: 90;
          box-shadow: var(--shadow-xl);
        }

        .reader-sidebar-header {
          padding: var(--space-4);
          border-bottom: 1px solid var(--color-border);
        }

        .reader-sidebar-tabs {
          display: flex;
          gap: var(--space-1);
          background: var(--color-bg-tertiary);
          padding: var(--space-1);
          border-radius: var(--radius-md);
        }

        .reader-sidebar-tab {
          flex: 1;
          padding: var(--space-2);
          font-size: var(--text-xs);
          font-weight: 500;
          text-align: center;
          border-radius: var(--radius-sm);
          background: transparent;
          border: none;
          color: var(--color-text-secondary);
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .reader-sidebar-tab.active {
          background: var(--color-bg-elevated);
          color: var(--color-text-primary);
          box-shadow: var(--shadow-sm);
        }

        .reader-sidebar-content {
          flex: 1;
          overflow-y: auto;
          padding: var(--space-4);
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: var(--space-8);
          text-align: center;
        }

        .empty-state-text {
          color: var(--color-text-tertiary);
          font-size: var(--text-sm);
          margin-bottom: var(--space-4);
        }

        .toc-list {
          display: flex;
          flex-direction: column;
        }

        .toc-item-container {
          display: flex;
          flex-direction: column;
        }

        .toc-item {
          display: block;
          width: 100%;
          padding: var(--space-2) var(--space-3);
          text-align: left;
          background: transparent;
          border: none;
          color: var(--color-text-primary);
          font-size: var(--text-sm);
          cursor: pointer;
          transition: all var(--transition-fast);
          border-radius: var(--radius-sm);
        }

        .toc-item:hover {
          background: var(--color-bg-elevated);
          color: var(--color-accent);
          padding-left: calc(var(--space-3) + 4px);
        }

        .toc-subitems {
          padding-left: var(--space-4);
        }

        .toc-subitem {
          font-size: var(--text-xs);
          color: var(--color-text-secondary);
        }

        .toc-subitem:hover {
          color: var(--color-accent);
        }

        .annotation-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }

        .annotation-item {
          display: flex;
          gap: var(--space-3);
          padding: var(--space-3);
          background: var(--color-bg-elevated);
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .annotation-item:hover {
          transform: translateX(4px);
        }

        .annotation-color {
          width: 4px;
          border-radius: var(--radius-full);
          flex-shrink: 0;
        }

        .annotation-content {
          flex: 1;
          min-width: 0;
        }

        .annotation-text {
          font-size: var(--text-sm);
          color: var(--color-text-primary);
          line-height: 1.5;
        }

        .annotation-note {
          font-size: var(--text-xs);
          color: var(--color-text-secondary);
          margin-top: var(--space-2);
          font-style: italic;
        }

        .annotation-context {
          display: flex;
          gap: var(--space-2);
          margin-bottom: var(--space-1);
          flex-wrap: wrap;
        }

        .context-chapter {
          font-size: var(--text-xs);
          color: var(--color-accent);
          font-weight: 500;
        }

        .context-page {
          font-size: var(--text-xs);
          color: var(--color-text-tertiary);
        }

        .annotation-actions {
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
          opacity: 0;
          transition: opacity var(--transition-fast);
        }

        .annotation-item:hover .annotation-actions {
          opacity: 1;
        }

        .action-btn {
          width: 28px;
          height: 28px;
          border-radius: var(--radius-md);
          border: none;
          background: var(--color-bg-secondary);
          color: var(--color-text-secondary);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all var(--transition-fast);
        }

        .action-btn:hover {
          background: var(--color-bg-tertiary);
          color: var(--color-text-primary);
        }

        .delete-btn:hover {
          background: var(--color-error);
          color: white;
        }

        .annotation-item.deleting {
          opacity: 0.5;
          border: 1px solid var(--color-error);
        }

        .sidebar-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          backdrop-filter: blur(4px);
        }

        .sidebar-modal-content {
          background: var(--color-bg-elevated);
          border-radius: var(--radius-lg);
          padding: var(--space-5);
          box-shadow: var(--shadow-xl);
          max-width: 340px;
          width: 90%;
        }

        .sidebar-modal-content h4 {
          font-size: var(--text-base);
          font-weight: 600;
          color: var(--color-text-primary);
          margin-bottom: var(--space-3);
        }

        .sidebar-modal-content > p {
          font-size: var(--text-sm);
          color: var(--color-text-secondary);
          margin-bottom: var(--space-4);
        }

        .modal-actions {
          display: flex;
          gap: var(--space-2);
          justify-content: flex-end;
        }

        .btn-danger {
          background: var(--color-error);
          color: white;
        }

        .btn-danger:hover {
          background: #c0392b;
        }

        .edit-text-preview {
          font-size: var(--text-sm);
          color: var(--color-text-secondary);
          font-style: italic;
          background: var(--color-bg-secondary);
          padding: var(--space-3);
          border-radius: var(--radius-md);
          margin-bottom: var(--space-4);
          max-height: 80px;
          overflow: hidden;
        }

        .edit-color-section,
        .edit-note-section {
          margin-bottom: var(--space-4);
        }

        .edit-color-section label,
        .edit-note-section label {
          display: block;
          font-size: var(--text-sm);
          color: var(--color-text-secondary);
          margin-bottom: var(--space-2);
        }

        .color-buttons {
          display: flex;
          gap: var(--space-2);
        }

        .color-btn {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: 2px solid transparent;
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .color-btn:hover {
          transform: scale(1.1);
        }

        .color-btn.selected {
          border-color: white;
          box-shadow: 0 0 0 2px var(--color-accent);
        }

        .edit-note-input {
          width: 100%;
          padding: var(--space-3);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          background: var(--color-bg-secondary);
          color: var(--color-text-primary);
          font-size: var(--text-sm);
          resize: none;
          font-family: inherit;
        }

        .edit-note-input:focus {
          outline: none;
          border-color: var(--color-accent);
        }

        .edit-note-input::placeholder {
          color: var(--color-text-tertiary);
        }

        .xray-sections {
          display: flex;
          flex-direction: column;
          gap: var(--space-6);
        }

        .xray-section-title {
          font-size: var(--text-sm);
          font-weight: 600;
          color: var(--color-text-primary);
          margin-bottom: var(--space-3);
        }

        .xray-item {
          padding: var(--space-3);
          background: var(--color-bg-elevated);
          border-radius: var(--radius-md);
          margin-bottom: var(--space-2);
        }

        .xray-name {
          font-size: var(--text-sm);
          font-weight: 600;
          color: var(--color-accent);
        }

        .xray-description {
          font-size: var(--text-xs);
          color: var(--color-text-secondary);
          margin-top: var(--space-1);
        }

        .settings-section {
          margin-bottom: var(--space-5);
        }

        .settings-label {
          display: block;
          font-size: var(--text-sm);
          color: var(--color-text-secondary);
          margin-bottom: var(--space-2);
        }

        .range-input {
          width: 100%;
          accent-color: var(--color-accent);
        }

        .theme-buttons,
        .align-buttons {
          display: flex;
          gap: var(--space-2);
        }

        .theme-btn,
        .align-btn {
          flex: 1;
          padding: var(--space-2) var(--space-3);
          font-size: var(--text-sm);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          background: var(--color-bg-elevated);
          color: var(--color-text-secondary);
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .theme-btn.light {
          background: #fff;
          color: #1d1d1f;
        }

        .theme-btn.sepia {
          background: #f4ecd8;
          color: #5c4b37;
        }

        .theme-btn.dark {
          background: #1c1c1e;
          color: #f5f5f7;
        }

        .theme-btn.active,
        .align-btn.active {
          border-color: var(--color-accent);
          box-shadow: 0 0 0 1px var(--color-accent);
        }

        .settings-toggle {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          cursor: pointer;
        }

        .settings-toggle input {
          width: 18px;
          height: 18px;
          accent-color: var(--color-accent);
        }

        .settings-toggle span {
          font-size: var(--text-sm);
          color: var(--color-text-primary);
        }
      `}</style>
        </aside>
    );
}

function getColorValue(color: Annotation['color']): string {
    const colors: Record<Annotation['color'], string> = {
        yellow: '#ffeb3b',
        green: '#4caf50',
        blue: '#2196f3',
        pink: '#e91e63',
        orange: '#ff9800',
    };
    return colors[color] || colors.yellow;
}
