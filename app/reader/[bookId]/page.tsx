'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useReaderStore, useAppStore } from '@/stores/appStore';
import { getBook, updateBook, getAnnotationsForBook, addAnnotation, updateAnnotation, deleteAnnotation, Annotation, Book, HighlightColor } from '@/lib/db';
import { EpubReader, EpubReaderRef, TocItem } from '@/components/reader/EpubReader';
import { ReaderToolbar } from '@/components/reader/ReaderToolbar';
import { ReaderSidebar } from '@/components/reader/ReaderSidebar';
import { v4 as uuid } from 'uuid';

export default function ReaderPage() {
    const params = useParams();
    const router = useRouter();
    const bookId = params.bookId as string;
    const contentRef = useRef<HTMLDivElement>(null);
    const epubReaderRef = useRef<EpubReaderRef>(null);

    const {
        book,
        setBook,
        isLoading,
        setIsLoading,
        annotations,
        setAnnotations,
        selectedText,
        selectionCfi,
        setSelection,
        clearSelection,
        setCurrentCfi,
        setCurrentPage,
        setTotalPages,
        setChapterTitle,
        currentPage,
        chapterTitle,
    } = useReaderStore();

    const { readerSidebarOpen, setReaderSidebarOpen, readerSettings } = useAppStore();
    const [showAnnotationPopover, setShowAnnotationPopover] = useState(false);
    const [popoverPosition, setPopoverPosition] = useState({ x: 0, y: 0 });
    const [selectedColor, setSelectedColor] = useState<Annotation['color']>('yellow');
    const [noteText, setNoteText] = useState('');
    const [toc, setToc] = useState<TocItem[]>([]);

    useEffect(() => {
        async function loadBook() {
            try {
                setIsLoading(true);
                const bookData = await getBook(bookId);
                if (!bookData) {
                    router.push('/');
                    return;
                }
                setBook(bookData);

                const bookAnnotations = await getAnnotationsForBook(bookId);
                setAnnotations(bookAnnotations);

                // Update last read time
                await updateBook(bookId, { lastReadAt: new Date() });
            } catch (error) {
                console.error('Failed to load book:', error);
                router.push('/');
            } finally {
                setIsLoading(false);
            }
        }

        loadBook();

        return () => {
            setBook(null);
            setAnnotations([]);
        };
    }, [bookId, router, setBook, setAnnotations, setIsLoading]);

    const handleLocationChange = useCallback(async (cfi: string, page: number, total: number, chapter: string) => {
        setCurrentCfi(cfi);
        setCurrentPage(page);
        setTotalPages(total);
        setChapterTitle(chapter);

        // Save reading progress
        if (book) {
            const progress = Math.round((page / total) * 100);
            await updateBook(bookId, {
                currentPosition: cfi,
                currentPage: page,
                totalPages: total,
                progress,
            });
        }
    }, [book, bookId, setCurrentCfi, setCurrentPage, setTotalPages, setChapterTitle]);

    const handleTextSelect = useCallback((text: string, cfi: string, rect: { x: number; y: number }) => {
        setSelection(text, cfi);
        setNoteText('');
        setSelectedColor('yellow');

        // Position popover above the selection
        // rect.x and rect.y are already in viewport coordinates from EpubReader
        const popoverWidth = 300; // approximate popover width
        const popoverHeight = 250; // approximate popover height

        // Ensure popover stays within viewport bounds
        const x = Math.max(popoverWidth / 2, Math.min(rect.x, window.innerWidth - popoverWidth / 2));
        const y = Math.max(popoverHeight + 20, rect.y); // Ensure enough space above for popover

        setPopoverPosition({ x, y });
        setShowAnnotationPopover(true);
    }, [setSelection]);

    const handleCreateAnnotation = useCallback(async () => {
        if (!selectedText || !selectionCfi || !book) return;

        const annotation: Annotation = {
            id: uuid(),
            bookId: book.id,
            cfi: selectionCfi,
            text: selectedText,
            note: noteText || undefined,
            color: selectedColor,
            chapterTitle: chapterTitle || undefined,
            pageNumber: currentPage || undefined,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        await addAnnotation(annotation);
        setAnnotations([...annotations, annotation]);
        setShowAnnotationPopover(false);
        setNoteText('');
        clearSelection();
    }, [selectedText, selectionCfi, book, annotations, setAnnotations, clearSelection, noteText, selectedColor, chapterTitle, currentPage]);

    const handleClosePopover = useCallback(() => {
        setShowAnnotationPopover(false);
        setNoteText('');
        clearSelection();
    }, [clearSelection]);

    // Navigate to annotation when clicked in sidebar
    const handleNavigateToAnnotation = useCallback((cfi: string) => {
        if (epubReaderRef.current) {
            epubReaderRef.current.navigateTo(cfi);
        }
    }, []);

    // Handle TOC loaded from EPUB
    const handleTocLoaded = useCallback((tocItems: TocItem[]) => {
        setToc(tocItems);
    }, []);

    // Navigate to TOC item
    const handleTocItemClick = useCallback((href: string) => {
        if (epubReaderRef.current) {
            epubReaderRef.current.navigateTo(href);
        }
    }, []);

    // Edit annotation
    const handleEditAnnotation = useCallback(async (id: string, updates: { note?: string; color?: HighlightColor }) => {
        await updateAnnotation(id, updates);
        setAnnotations(annotations.map(a =>
            a.id === id
                ? { ...a, ...updates, updatedAt: new Date() }
                : a
        ));
    }, [annotations, setAnnotations]);

    // Delete annotation
    const handleDeleteAnnotation = useCallback(async (id: string) => {
        await deleteAnnotation(id);
        setAnnotations(annotations.filter(a => a.id !== id));
    }, [annotations, setAnnotations]);

    if (isLoading || !book) {
        return (
            <div className="reader-loading">
                <div className="loading-spinner" />
                <p>Cargando libro...</p>
                <style jsx>{`
          .reader-loading {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            background: var(--color-bg-primary);
          }
          .loading-spinner {
            width: 48px;
            height: 48px;
            border: 3px solid var(--color-border);
            border-top-color: var(--color-accent);
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          .reader-loading p {
            margin-top: var(--space-4);
            color: var(--color-text-secondary);
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
            </div>
        );
    }

    return (
        <div className="reader-container">
            <div className="reader-main">
                <ReaderToolbar book={book} />

                <div className="reader-content" ref={contentRef}>
                    {book.format === 'epub' ? (
                        <EpubReader
                            ref={epubReaderRef}
                            book={book}
                            onLocationChange={handleLocationChange}
                            onTextSelect={handleTextSelect}
                            onTocLoaded={handleTocLoaded}
                            annotations={annotations}
                            settings={readerSettings}
                        />
                    ) : (
                        <div className="pdf-placeholder">
                            <p>Visor PDF próximamente</p>
                        </div>
                    )}
                </div>
            </div>

            {readerSidebarOpen && (
                <ReaderSidebar
                    book={book}
                    annotations={annotations}
                    toc={toc}
                    onAnnotationClick={handleNavigateToAnnotation}
                    onTocItemClick={handleTocItemClick}
                    onEditAnnotation={handleEditAnnotation}
                    onDeleteAnnotation={handleDeleteAnnotation}
                />
            )}

            {/* Enhanced Annotation Popover */}
            {showAnnotationPopover && (
                <div
                    className="annotation-popover"
                    style={{
                        left: `${popoverPosition.x}px`,
                        top: `${popoverPosition.y}px`,
                    }}
                >
                    <div className="popover-content glass">
                        <div className="popover-header">
                            <span className="popover-title">Nueva anotación</span>
                            <button className="close-btn" onClick={handleClosePopover}>×</button>
                        </div>

                        <div className="selected-text">
                            "{selectedText?.substring(0, 100)}{selectedText && selectedText.length > 100 ? '...' : ''}"
                        </div>

                        <div className="color-buttons">
                            {(['yellow', 'green', 'blue', 'pink', 'orange'] as const).map((color) => (
                                <button
                                    key={color}
                                    className={`color-btn ${selectedColor === color ? 'selected' : ''}`}
                                    style={{ backgroundColor: getColorHex(color) }}
                                    onClick={() => setSelectedColor(color)}
                                    title={color}
                                />
                            ))}
                        </div>

                        <textarea
                            className="note-input"
                            placeholder="Añade una nota (opcional)..."
                            value={noteText}
                            onChange={(e) => setNoteText(e.target.value)}
                            rows={3}
                        />

                        <div className="popover-actions">
                            <button className="btn btn-ghost btn-sm" onClick={handleClosePopover}>
                                Cancelar
                            </button>
                            <button className="btn btn-primary btn-sm" onClick={handleCreateAnnotation}>
                                Guardar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Floating sidebar toggle button */}
            <button
                className="sidebar-toggle-fab"
                onClick={() => setReaderSidebarOpen(!readerSidebarOpen)}
                title={readerSidebarOpen ? 'Cerrar panel' : 'Abrir panel'}
            >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                    {readerSidebarOpen ? (
                        <polyline points="9 18 15 12 9 6" />
                    ) : (
                        <polyline points="15 18 9 12 15 6" />
                    )}
                </svg>
            </button>

            <style jsx>{`
        .reader-container {
          display: flex;
          height: 100vh;
          background: var(--color-bg-primary);
          width: 100%;
          position: relative;
        }

        .reader-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .reader-content {
          flex: 1;
          overflow: hidden;
          position: relative;
        }

        .pdf-placeholder {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: var(--color-text-secondary);
        }

        .annotation-popover {
          position: fixed;
          transform: translateX(-50%) translateY(-100%);
          z-index: 1000;
          margin-top: -10px;
        }

        .popover-content {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
          padding: var(--space-4);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-xl);
          min-width: 280px;
          max-width: 350px;
        }

        .popover-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .popover-title {
          font-weight: 600;
          color: var(--color-text-primary);
        }

        .close-btn {
          background: none;
          border: none;
          font-size: 1.5rem;
          cursor: pointer;
          color: var(--color-text-secondary);
          line-height: 1;
        }

        .selected-text {
          font-size: 0.85rem;
          color: var(--color-text-secondary);
          font-style: italic;
          padding: var(--space-2);
          background: var(--color-bg-secondary);
          border-radius: var(--radius-md);
          max-height: 60px;
          overflow: hidden;
        }

        .color-buttons {
          display: flex;
          gap: var(--space-2);
          justify-content: center;
        }

        .color-btn {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: 3px solid transparent;
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .color-btn:hover {
          transform: scale(1.15);
        }

        .color-btn.selected {
          border-color: white;
          box-shadow: 0 0 0 2px var(--color-accent);
        }

        .note-input {
          width: 100%;
          padding: var(--space-3);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          background: var(--color-bg-secondary);
          color: var(--color-text-primary);
          font-size: 0.9rem;
          resize: none;
          font-family: inherit;
        }

        .note-input:focus {
          outline: none;
          border-color: var(--color-accent);
        }

        .note-input::placeholder {
          color: var(--color-text-tertiary);
        }

        .popover-actions {
          display: flex;
          gap: var(--space-2);
          justify-content: flex-end;
        }

        .sidebar-toggle-fab {
          position: fixed;
          right: ${readerSidebarOpen ? '340px' : '20px'};
          top: 50%;
          transform: translateY(-50%);
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: var(--color-bg-elevated);
          border: 1px solid var(--color-border);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 100;
          transition: all var(--transition-normal);
          box-shadow: var(--shadow-md);
          color: var(--color-text-secondary);
        }

        .sidebar-toggle-fab:hover {
          background: var(--color-accent);
          color: white;
          border-color: var(--color-accent);
        }
      `}</style>
        </div>
    );
}

function getColorHex(color: Annotation['color']): string {
    const colors: Record<Annotation['color'], string> = {
        yellow: '#ffeb3b',
        green: '#4caf50',
        blue: '#2196f3',
        pink: '#e91e63',
        orange: '#ff9800',
    };
    return colors[color] || colors.yellow;
}
