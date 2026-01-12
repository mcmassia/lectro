'use client';

import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Book, Annotation, ReaderSettings } from '@/lib/db';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure worker locally or via CDN
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfReaderProps {
    book: Book;
    onLocationChange: (cfi: string, page: number, total: number, chapter: string) => void;
    annotations: Annotation[];
    settings: ReaderSettings;
}

export interface PdfReaderRef {
    navigateTo: (pageNumber: number) => void;
}

export const PdfReader = forwardRef<PdfReaderRef, PdfReaderProps>(({ book, onLocationChange, settings }, ref) => {
    const [numPages, setNumPages] = useState<number>(0);
    const [pageNumber, setPageNumber] = useState<number>(1);
    const [scale, setScale] = useState(1.0);
    const containerRef = useRef<HTMLDivElement>(null);

    // Initial load of saved position
    useEffect(() => {
        if (book.currentPage) {
            setPageNumber(book.currentPage);
        }
    }, [book.currentPage]);

    useImperativeHandle(ref, () => ({
        navigateTo: (page: number) => {
            const p = Math.max(1, Math.min(page, numPages));
            setPageNumber(p);
            notifyLocationChange(p, numPages);
        }
    }));

    function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
        setNumPages(numPages);
        const initialPage = book.currentPage || 1;
        setPageNumber(initialPage);
        notifyLocationChange(initialPage, numPages);
    }

    function notifyLocationChange(page: number, total: number) {
        // PDF doesn't have CFIs, so we use stringified page number as "CFI"
        onLocationChange(page.toString(), page, total, `Page ${page}`);
    }

    function changePage(offset: number) {
        setPageNumber(prev => {
            const newPage = Math.max(1, Math.min(prev + offset, numPages));
            notifyLocationChange(newPage, numPages);
            return newPage;
        });
    }

    return (
        <div className="pdf-reader-container" ref={containerRef}>
            <div className="pdf-document-wrapper">
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
                        width={containerRef.current?.clientWidth ? containerRef.current.clientWidth - 40 : undefined}
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
