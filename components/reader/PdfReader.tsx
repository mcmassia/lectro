'use client';

import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Book, Annotation, ReaderSettings } from '@/lib/db';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { TocItem } from './EpubReader';

// Configure worker locally or via CDN
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfReaderProps {
    book: Book;
    onLocationChange: (cfi: string, page: number, total: number, chapter: string) => void;
    annotations: Annotation[];
    settings: ReaderSettings;
    onTocLoaded?: (toc: TocItem[]) => void;
}

export interface PdfReaderRef {
    navigateTo: (dest: string | number) => void;
}

export const PdfReader = forwardRef<PdfReaderRef, PdfReaderProps>(({ book, onLocationChange, settings, onTocLoaded }, ref) => {
    const [numPages, setNumPages] = useState<number>(0);
    const [pageNumber, setPageNumber] = useState<number>(1);
    const [scale, setScale] = useState(1.0);
    const containerRef = useRef<HTMLDivElement>(null);
    const [pageWidth, setPageWidth] = useState<number | undefined>(undefined);

    // Initial load of saved position
    useEffect(() => {
        if (book.currentPage) {
            setPageNumber(book.currentPage);
        }
    }, [book.currentPage]);

    // Handle Resize
    useEffect(() => {
        const updateWidth = () => {
            if (containerRef.current) {
                setPageWidth(containerRef.current.clientWidth - 40); // 40px padding
            }
        };

        // Initial sizing
        updateWidth();

        const observer = new ResizeObserver(() => {
            updateWidth();
        });

        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => observer.disconnect();
    }, []);

    useImperativeHandle(ref, () => ({
        navigateTo: (dest: string | number) => {
            let page = 1;
            if (typeof dest === 'number') {
                page = dest;
            } else if (typeof dest === 'string') {
                const parsed = parseInt(dest, 10);
                if (!isNaN(parsed)) {
                    page = parsed;
                } else {
                    console.warn('PdfReader: Could not parse navigation destination:', dest);
                    return;
                }
            }
            const p = Math.max(1, Math.min(page, numPages));
            setPageNumber(p);
            notifyLocationChange(p, numPages);
        }
    }));

    function onDocumentLoadSuccess(pdf: any) {
        setNumPages(pdf.numPages);
        const initialPage = book.currentPage || 1;
        setPageNumber(initialPage);
        notifyLocationChange(initialPage, pdf.numPages);

        // Load TOC
        pdf.getOutline().then((outline: any[]) => {
            if (outline && outline.length > 0) {
                const convertOutline = (items: any[]): TocItem[] => {
                    return items.map(item => ({
                        label: item.title,
                        href: JSON.stringify(item.dest), // Store dest as string to parse later or handle
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

    // Handle text selection
    useEffect(() => {
        const handleSelection = () => {
            const selection = window.getSelection();
            if (!selection || selection.isCollapsed) return;

            // Check if selection is within our container
            if (containerRef.current && containerRef.current.contains(selection.anchorNode)) {
                const text = selection.toString();
                if (text) {
                    // We don't have CFI in PDF, use page number + exact text as locator?
                    // Or just generic "Page X" location.
                    console.log('PDF Text Selected:', text);
                    // PDF annotations are tricky without exact coordinates relative to PDF canvas.
                    // For now, simpler implementation:
                }
            }
        };

        document.addEventListener('selectionchange', handleSelection);
        return () => document.removeEventListener('selectionchange', handleSelection);
    }, []);

    function notifyLocationChange(page: number, total: number) {
        // PDF doesn't have CFIs, so we use stringified page number as "CFI"
        onLocationChange(page.toString(), page, total, `Página ${page}`);
    }

    function changePage(offset: number) {
        setPageNumber(prev => {
            const newPage = Math.max(1, Math.min(prev + offset, numPages));
            notifyLocationChange(newPage, numPages);
            return newPage;
        });
    }

    // Determine filter for themes
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

    return (
        <div className="pdf-reader-container" ref={containerRef}>
            <div className="pdf-document-wrapper" style={getThemeStyle()}>
                <Document
                    file={book.fileBlob || book.cover} // book.fileBlob should be the file object/blob
                    onLoadSuccess={onDocumentLoadSuccess}
                    className="pdf-document"
                    loading={<div className="loading">Cargando PDF...</div>}
                    error={<div className="error">Error al cargar el PDF.</div>}
                >
                    <Page
                        pageNumber={pageNumber}
                        scale={scale}
                        renderTextLayer={true}
                        renderAnnotationLayer={true}
                        className="pdf-page"
                        width={pageWidth}
                    />
                </Document>
            </div>

            <div className="pdf-controls">
                <button
                    className="btn-control"
                    disabled={pageNumber <= 1}
                    onClick={() => changePage(-1)}
                >
                    Anterior
                </button>
                <div className="page-info">
                    Página {pageNumber} de {numPages}
                </div>
                <button
                    className="btn-control"
                    disabled={pageNumber >= numPages}
                    onClick={() => changePage(1)}
                >
                    Siguiente
                </button>
            </div>

            <style jsx>{`
                .pdf-reader-container {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    height: 100%;
                    overflow-y: auto;
                    background: var(--color-bg-tertiary);
                    padding: var(--space-4);
                }
                
                .pdf-document-wrapper {
                    box-shadow: var(--shadow-lg);
                    margin-bottom: var(--space-4);
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
            `}</style>
        </div>
    );
});

PdfReader.displayName = 'PdfReader';
