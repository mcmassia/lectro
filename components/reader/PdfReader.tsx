'use client';

import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Book, Annotation, ReaderSettings } from '@/lib/db';
import { useInView } from 'react-intersection-observer';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { TocItem } from './EpubReader';

// Use unpkg for worker to avoid build complexity with webpack/files
// Ensure version matches exactly with package.json
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfReaderProps {
    book: Book;
    onLocationChange: (cfi: string, page: number, total: number, chapter: string) => void;
    onTextSelect?: (text: string, cfi: string, rect: { x: number; y: number }) => void;
    annotations: Annotation[];
    settings: ReaderSettings;
    onTocLoaded?: (toc: TocItem[]) => void;
}

export interface PdfReaderRef {
    navigateTo: (dest: string | number) => void;
}

// Scrolled Page Component to handle lazy visibility updates
const ScrollPage = ({
    pageNumber,
    width,
    onVisible,
    scale
}: {
    pageNumber: number;
    width?: number;
    onVisible: (p: number) => void;
    scale: number;
}) => {
    const { ref, inView } = useInView({ threshold: 0.5 });

    useEffect(() => {
        if (inView) {
            onVisible(pageNumber);
        }
    }, [inView, pageNumber, onVisible]);

    return (
        <div ref={ref} id={`pdf-page-${pageNumber}`} className="pdf-scroll-page">
            <Page
                pageNumber={pageNumber}
                scale={scale}
                renderTextLayer={true}
                renderAnnotationLayer={true}
                className="pdf-page"
                width={width}
                loading={<div className="page-loading" style={{ height: width ? width * 1.4 : 800 }}>Cargando página {pageNumber}...</div>}
            />
            <div className="page-number-indicator">{pageNumber}</div>
        </div>
    );
};

export const PdfReader = forwardRef<PdfReaderRef, PdfReaderProps>(({ book, onLocationChange, onTextSelect, settings, onTocLoaded }, ref) => {
    const [numPages, setNumPages] = useState<number>(0);
    const [pageNumber, setPageNumber] = useState<number>(1);
    const containerRef = useRef<HTMLDivElement>(null);
    const [pageWidth, setPageWidth] = useState<number | undefined>(undefined);
    const [useNative, setUseNative] = useState(false);
    const [loading, setLoading] = useState(true);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [zoomLevel, setZoomLevel] = useState(1.0);
    const isScrollMode = settings.scrollMode;

    // Initial load of saved position
    useEffect(() => {
        if (book.currentPage) {
            setPageNumber(book.currentPage);
        }
    }, [book.currentPage]);

    // Cleanup URL
    useEffect(() => {
        let url = '';
        if (book.fileBlob) {
            url = URL.createObjectURL(book.fileBlob);
            setPdfUrl(url);
        } else if (book.cover && !book.fileBlob) {
            // Fallback logic
        }

        return () => {
            if (url) {
                URL.revokeObjectURL(url);
            }
        };
    }, [book]);

    // Handle Layout & Zoom
    useEffect(() => {
        const updateLayout = () => {
            if (containerRef.current) {
                const containerW = containerRef.current.clientWidth;
                // In scroll mode we might want slightly less padding or same?
                // Keeping 90% logic for consistency.
                const baseWidth = (containerW * 0.90);
                const finalWidth = baseWidth * zoomLevel;

                if (finalWidth > 0) {
                    setPageWidth(finalWidth);
                }
            }
        };

        const timer = setTimeout(updateLayout, 100);
        updateLayout();

        window.addEventListener('resize', updateLayout);
        return () => {
            window.removeEventListener('resize', updateLayout);
            clearTimeout(timer);
        };
    }, [zoomLevel, settings.scrollMode]);

    useImperativeHandle(ref, () => ({
        navigateTo: (dest: string | number) => {
            let page = 1;
            if (typeof dest === 'number') {
                page = dest;
            } else if (typeof dest === 'string') {
                const parsed = parseInt(dest, 10);
                if (!isNaN(parsed)) {
                    page = parsed;
                }
            }
            const p = Math.max(1, Math.min(page, numPages));
            setPageNumber(p);

            if (isScrollMode) {
                scrollToPage(p);
            } else {
                notifyLocationChange(p, numPages);
            }
        }
    }));

    function scrollToPage(page: number) {
        const el = document.getElementById(`pdf-page-${page}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    function onDocumentLoadSuccess(pdf: any) {
        setNumPages(pdf.numPages);
        setLoading(false);
        const initialPage = book.currentPage || 1;

        // Don't auto-set pageNumber here if we already have it, 
        // but essential for first load.
        setPageNumber(initialPage);
        notifyLocationChange(initialPage, pdf.numPages);

        if (isScrollMode) {
            // Delay scroll to allow render
            setTimeout(() => {
                scrollToPage(initialPage);
            }, 500);
        }

        // Load TOC
        pdf.getOutline().then((outline: any[]) => {
            if (outline && outline.length > 0) {
                const convertOutline = (items: any[]): TocItem[] => {
                    return items.map(item => ({
                        label: item.title,
                        href: JSON.stringify(item.dest),
                        subitems: item.items && item.items.length > 0 ? convertOutline(item.items) : undefined
                    }));
                };
                const toc = convertOutline(outline);
                if (onTocLoaded) {
                    onTocLoaded(toc);
                }
            }
        });
    }

    function onDocumentLoadError(error: Error) {
        console.error('Error loading PDF:', error);
        setUseNative(true);
        setLoading(false);
    }

    // Handle text selection
    useEffect(() => {
        if (useNative) return;

        const handleSelection = () => {
            // Debounce slightly to ensure selection is complete?
            setTimeout(() => {
                const selection = window.getSelection();
                if (!selection || selection.isCollapsed) return;

                // Check if selection is within our container
                if (containerRef.current && containerRef.current.contains(selection.anchorNode)) {
                    const text = selection.toString();
                    if (text && text.trim().length > 0) {
                        const range = selection.getRangeAt(0);
                        const rect = range.getBoundingClientRect();
                        const cfi = `pdf:page=${pageNumber}:quote=${text.substring(0, 20)}`;

                        if (onTextSelect) {
                            onTextSelect(text, cfi, { x: rect.left + (rect.width / 2), y: rect.top });
                        }
                    }
                }
            }, 100);
        };

        const container = containerRef.current;
        if (container) {
            container.addEventListener('mouseup', handleSelection);
        }
        return () => {
            if (container) {
                container.removeEventListener('mouseup', handleSelection);
            }
        };
    }, [useNative, pageNumber, onTextSelect]);

    function notifyLocationChange(page: number, total: number) {
        setTimeout(() => {
            onLocationChange(page.toString(), page, total, `Página ${page}`);
        }, 0);
    }

    function changePage(offset: number) {
        setPageNumber(prev => {
            const newPage = Math.max(1, Math.min(prev + offset, numPages));
            notifyLocationChange(newPage, numPages);
            return newPage;
        });
    }

    function handleZoomIn() {
        setZoomLevel(prev => Math.min(prev + 0.2, 3.0));
    }

    function handleZoomOut() {
        setZoomLevel(prev => Math.max(prev - 0.2, 0.4));
    }

    function handleFitWidth() {
        setZoomLevel(1.0);
    }

    const getThemeStyle = () => {
        switch (settings.theme) {
            case 'dark':
                return { filter: 'invert(1) hue-rotate(180deg) contrast(0.8)' };
            case 'sepia':
                return { filter: 'sepia(0.3) contrast(0.95) brightness(0.95)' };
            default:
                return {};
        }
    };

    if (useNative && pdfUrl) {
        return (
            <div className="pdf-reader-container">
                <div className="native-fallback-banner">
                    Usando visor nativo (sin progreso ni anotaciones)
                    <button onClick={() => setUseNative(false)} className="btn-retry">Reintentar</button>
                    <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="btn-retry" style={{ marginLeft: 10 }}>Abrir en Pestaña Nueva</a>
                </div>
                <iframe
                    ref={iframeRef}
                    src={`${pdfUrl}#page=${pageNumber}&view=FitH`}
                    className="pdf-iframe"
                    title={book.title}
                />
                <style jsx>{`
                    .pdf-reader-container { width: 100%; height: 100%; display: flex; flex-direction: column; background: var(--color-bg-tertiary); }
                    .pdf-iframe { width: 100%; height: 100%; border: none; background: white; }
                    .native-fallback-banner { 
                        background: var(--color-warning); 
                        color: var(--color-bg-primary); 
                        padding: 8px; 
                        text-align: center; 
                        font-size: 12px; 
                        display: flex; 
                        justify-content: center; 
                        gap: 10px; 
                        align-items: center; 
                    }
                    .btn-retry { background: rgba(0,0,0,0.2); border: none; padding: 2px 8px; border-radius: 4px; cursor: pointer; color: inherit; text-decoration: none; }
                `}</style>
            </div>
        );
    }

    return (
        <div className="pdf-reader-container" ref={containerRef}>
            {!useNative && (
                <div className="force-native-wrapper">
                    <button onClick={() => setUseNative(true)} className="btn-force-native">
                        ¿Problemas? Usar visor nativo
                    </button>
                </div>
            )}

            <div className="zoom-controls">
                <button onClick={handleZoomOut} className="btn-zoom" title="Reducir">-</button>
                <div className="zoom-level">{Math.round(zoomLevel * 100)}%</div>
                <button onClick={handleZoomIn} className="btn-zoom" title="Aumentar">+</button>
                <button onClick={handleFitWidth} className="btn-zoom" title="Ajustar ancho">↔</button>
            </div>

            <div className={`pdf-document-wrapper ${isScrollMode ? 'scrolled' : 'paginated'}`} style={getThemeStyle()}>
                <Document
                    file={book.fileBlob || book.cover}
                    onLoadSuccess={onDocumentLoadSuccess}
                    onLoadError={onDocumentLoadError}
                    className="pdf-document"
                    loading={<div className="loading">Cargando PDF...</div>}
                    error={<div className="error">Error.</div>}
                >
                    {isScrollMode ? (
                        Array.from(new Array(numPages), (el, index) => (
                            <ScrollPage
                                key={`page_${index + 1}`}
                                pageNumber={index + 1}
                                width={pageWidth}
                                scale={1.0} // Scale via width
                                onVisible={(p) => {
                                    setPageNumber(p);
                                    notifyLocationChange(p, numPages);
                                }}
                            />
                        ))
                    ) : (
                        <Page
                            pageNumber={pageNumber}
                            scale={1.0}
                            renderTextLayer={true}
                            renderAnnotationLayer={true}
                            className="pdf-page"
                            width={pageWidth}
                        />
                    )}
                </Document>
            </div>

            {!isScrollMode && (
                <div className="pdf-controls">
                    <button
                        className="btn-control"
                        disabled={pageNumber <= 1}
                        onClick={() => changePage(-1)}
                    >
                        Anterior
                    </button>
                    <div className="page-info">
                        Página {pageNumber} de {numPages || '?'}
                    </div>
                    <button
                        className="btn-control"
                        disabled={pageNumber >= (numPages || 1)}
                        onClick={() => changePage(1)}
                    >
                        Siguiente
                    </button>
                </div>
            )}

            {isScrollMode && (
                <div className="pdf-floating-info">
                    {pageNumber} / {numPages || '?'}
                </div>
            )}

            <style jsx>{`
                .pdf-reader-container {
                    width: 100%;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    height: 100%;
                    overflow-y: auto;
                    background: var(--color-bg-tertiary);
                    padding: var(--space-4);
                    padding-top: 60px;
                    position: relative;
                    scroll-behavior: smooth;
                }
                
                .pdf-document-wrapper {
                    min-height: 500px;
                    transition: width 0.2s ease-out;
                }
                
                .pdf-document-wrapper.paginated {
                    box-shadow: var(--shadow-lg);
                    margin-bottom: 80px; 
                }
                
                /* In scroll mode, wrapper contains many styled page divs */
                .pdf-document-wrapper.scrolled {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 20px;
                    padding-bottom: 100px;
                }
                
                :global(.pdf-scroll-page) {
                    box-shadow: var(--shadow-md);
                    position: relative;
                    background: white;
                }
                
                .page-number-indicator {
                    position: absolute;
                    top: 10px;
                    right: -40px;
                    color: var(--color-text-secondary);
                    font-size: 10px;
                }

                .pdf-controls {
                    position: fixed;
                    bottom: var(--space-4);
                    left: 50%;
                    transform: translateX(-50%);
                    display: flex;
                    align-items: center;
                    gap: var(--space-4);
                    background: var(--color-bg-elevated);
                    padding: var(--space-2) var(--space-4);
                    border-radius: var(--radius-full);
                    box-shadow: var(--shadow-lg);
                    z-index: 100;
                }
                
                .pdf-floating-info {
                    position: fixed;
                    bottom: var(--space-4);
                    left: 20px;
                    background: var(--color-bg-elevated);
                    padding: 4px 10px;
                    border-radius: 12px;
                    font-size: 12px;
                    box-shadow: var(--shadow-md);
                    z-index: 90;
                }

                .zoom-controls {
                    position: fixed;
                    bottom: var(--space-4);
                    right: var(--space-6);
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    background: var(--color-bg-elevated);
                    padding: 4px;
                    border-radius: var(--radius-full);
                    box-shadow: var(--shadow-lg);
                    z-index: 100;
                }
                
                .btn-zoom {
                    width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border: none;
                    background: transparent;
                    color: var(--color-text-primary);
                    border-radius: 50%;
                    cursor: pointer;
                    font-size: 16px;
                }
                .btn-zoom:hover {
                    background: var(--color-bg-tertiary);
                }
                .zoom-level {
                    font-size: 12px;
                    font-weight: 500;
                    padding: 0 8px;
                    min-width: 40px;
                    text-align: center;
                }

                .page-info {
                    font-size: var(--text-sm);
                    font-weight: 500;
                }

                .btn-control {
                    padding: var(--space-2) var(--space-4);
                    border-radius: var(--radius-md);
                    background: var(--color-bg-secondary);
                    color: var(--color-text-primary);
                    font-size: var(--text-sm);
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .btn-control:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .btn-control:not(:disabled):hover {
                    background: var(--color-bg-tertiary);
                }
                
                .force-native-wrapper {
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    z-index: 50;
                }
                
                .btn-force-native {
                    background: rgba(0,0,0,0.5);
                    color: white;
                    border: none;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 10px;
                    cursor: pointer;
                }
                .btn-force-native:hover {
                    background: rgba(0,0,0,0.7);
                }
                
                .loading { color: var(--color-text-tertiary); padding: 20px; }
                
                .page-loading {
                     display: flex;
                     align-items: center;
                     justify-content: center;
                     background: white;
                     color: #ccc;
                     border: 1px dashed #eee;
                }
            `}</style>
        </div>
    );
});
