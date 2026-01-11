'use client';

import { useEffect, useRef, useCallback, useState, forwardRef, useImperativeHandle } from 'react';
import ePub, { Book as EpubBook, Rendition, Contents, NavItem } from 'epubjs';
import { Book, Annotation, ReaderSettings } from '@/lib/db';

export interface TocItem {
    label: string;
    href: string;
    subitems?: TocItem[];
}

interface EpubReaderProps {
    book: Book;
    onLocationChange: (cfi: string, page: number, total: number, chapter: string) => void;
    onTextSelect: (text: string, cfi: string, rect: { x: number; y: number }) => void;
    onTocLoaded?: (toc: TocItem[]) => void;
    annotations: Annotation[];
    settings: ReaderSettings;
}

export interface EpubReaderRef {
    navigateTo: (cfi: string) => void;
}

export const EpubReader = forwardRef<EpubReaderRef, EpubReaderProps>(function EpubReader({
    book,
    onLocationChange,
    onTextSelect,
    onTocLoaded,
    annotations,
    settings,
}, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const epubRef = useRef<EpubBook | null>(null);
    const renditionRef = useRef<Rendition | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Expose navigation method via ref
    useImperativeHandle(ref, () => ({
        navigateTo: (href: string) => {
            if (renditionRef.current) {
                const rendition = renditionRef.current as any;
                const hrefBase = href.split('#')[0];
                const targetFilename = hrefBase.split('/').pop() || '';

                // Display the target section
                rendition.display(href).then(() => {
                    // In continuous scroll mode, find and scroll to the correct view
                    if (settings.scrollMode) {
                        setTimeout(() => {
                            const manager = rendition.manager;
                            if (manager && manager.views && manager.container) {
                                // Iterate through all views to find the one matching our href
                                const views = manager.views._views || manager.views.all() || [];
                                for (const view of views) {
                                    // Each view has a section with an href
                                    const viewHref = view.section?.href || view.section?.cfiBase || '';
                                    if (viewHref.includes(targetFilename)) {
                                        // Scroll the container so this view is at the top
                                        if (view.element) {
                                            manager.container.scrollTop = view.element.offsetTop;
                                        }
                                        break;
                                    }
                                }
                            }
                        }, 150);
                    }
                }).catch((err: Error) => {
                    console.warn('Navigation error:', err);
                });
            }
        },
    }), [settings.scrollMode]);

    // Apply reader settings as CSS
    const getReaderStyles = useCallback(() => {
        const themeColors = {
            light: { bg: '#ffffff', text: '#1d1d1f' },
            sepia: { bg: '#f4ecd8', text: '#5c4b37' },
            dark: { bg: '#1c1c1e', text: '#f5f5f7' },
        };

        const theme = settings?.theme || 'light';
        const colors = themeColors[theme] || themeColors.light;

        return {
            body: {
                'font-family': settings.fontFamily,
                'font-size': `${settings.fontSize}px`,
                'line-height': String(settings.lineHeight),
                'letter-spacing': `${settings.letterSpacing}em`,
                'text-align': settings.textAlign,
                'background-color': colors.bg,
                'color': colors.text,
                'padding': `${settings.marginVertical}px ${settings.marginHorizontal}px`,
            },
            'p, div': {
                'margin-bottom': '1em',
            },
            'h1, h2, h3, h4, h5, h6': {
                'font-family': settings.fontFamily,
                'line-height': '1.3',
                'margin-top': '1.5em',
                'margin-bottom': '0.5em',
            },
            'img': {
                'max-width': '100%',
                'height': 'auto',
            },
            '::selection': {
                'background-color': 'rgba(0, 122, 255, 0.3)',
            },
        };
    }, [settings]);

    // Navigation handlers
    const goNext = useCallback(() => {
        renditionRef.current?.next();
    }, []);

    const goPrev = useCallback(() => {
        renditionRef.current?.prev();
    }, []);

    // Initialize EPUB
    useEffect(() => {
        if (!containerRef.current || !book.fileBlob) return;

        let mounted = true;

        const initEpub = async () => {
            try {
                setIsLoading(true);
                setError(null);

                // Clean up previous instance
                if (epubRef.current) {
                    epubRef.current.destroy();
                    epubRef.current = null;
                }

                // Create array buffer from blob
                const arrayBuffer = await book.fileBlob.arrayBuffer();

                // Initialize epub
                const epub = ePub(arrayBuffer);
                epubRef.current = epub;

                await epub.ready;

                if (!mounted || !containerRef.current) return;

                // Clear the container
                containerRef.current.innerHTML = '';

                // Create rendition with proper settings
                const rendition = epub.renderTo(containerRef.current, {
                    width: '100%',
                    height: '100%',
                    spread: 'none',
                    flow: settings.scrollMode ? 'scrolled-doc' : 'paginated',
                    manager: settings.scrollMode ? 'continuous' : 'default',
                });

                renditionRef.current = rendition;

                // Apply styles
                rendition.themes.default(getReaderStyles());

                // Generate locations for accurate page numbers (with fallback)
                let totalPages = 100; // Default fallback
                let locationsAvailable = false;

                try {
                    if (epub.locations) {
                        await epub.locations.generate(1024);
                        totalPages = epub.locations.length() || 100;
                        locationsAvailable = true;
                    }
                } catch (locErr) {
                    console.warn('Could not generate locations, using fallback pagination:', locErr);
                }

                // Handle location changes
                rendition.on('relocated', (location: any) => {
                    if (!mounted) return;

                    const currentCfi = location.start.cfi;

                    // Calculate page from locations or use displayed page
                    let currentPage = 1;
                    let displayedTotal = totalPages;

                    if (locationsAvailable && epub.locations) {
                        try {
                            const currentLocation = epub.locations.locationFromCfi(currentCfi) as unknown as number;
                            currentPage = typeof currentLocation === 'number' ? currentLocation + 1 : 1;
                        } catch {
                            currentPage = location.start.displayed?.page || 1;
                            displayedTotal = location.start.displayed?.total || totalPages;
                        }
                    } else {
                        // Use displayed page info from epub.js
                        currentPage = location.start.displayed?.page || 1;
                        displayedTotal = location.start.displayed?.total || totalPages;
                    }

                    // Get chapter title from navigation
                    let chapterTitle = 'Cargando...';

                    if (epub.navigation && epub.navigation.toc) {
                        const href = location.start.href;
                        const findChapter = (items: NavItem[]): string | null => {
                            for (const item of items) {
                                if (href && href.includes(item.href.split('#')[0])) {
                                    return item.label;
                                }
                                if (item.subitems) {
                                    const found = findChapter(item.subitems);
                                    if (found) return found;
                                }
                            }
                            return null;
                        };
                        chapterTitle = findChapter(epub.navigation.toc) || 'Capítulo';
                    }

                    onLocationChange(currentCfi, currentPage, totalPages, chapterTitle);
                });

                // Handle text selection
                rendition.on('selected', (cfiRange: string, contents: Contents) => {
                    const selection = contents.window.getSelection();
                    if (!selection || selection.isCollapsed) return;

                    const text = selection.toString().trim();
                    if (!text) return;

                    try {
                        const range = selection.getRangeAt(0);
                        const rect = range.getBoundingClientRect();

                        // Get the iframe element
                        const iframe = containerRef.current?.querySelector('iframe');
                        const iframeRect = iframe?.getBoundingClientRect();

                        if (iframeRect) {
                            // Convert iframe-relative coords to viewport coords
                            const viewportX = iframeRect.left + rect.left + (rect.width / 2);
                            const viewportY = iframeRect.top + rect.top;

                            console.log('Text selected:', text.substring(0, 50), 'at', viewportX, viewportY);
                            onTextSelect(text, cfiRange, { x: viewportX, y: viewportY });
                        }
                    } catch (err) {
                        console.warn('Could not get selection rect:', err);
                    }
                });

                // Apply existing annotations after display
                rendition.on('rendered', () => {
                    annotations.forEach((annotation) => {
                        const color = getHighlightColor(annotation.color);
                        try {
                            rendition.annotations.highlight(
                                annotation.cfi,
                                {},
                                () => console.log('Annotation clicked:', annotation.id),
                                'highlight',
                                { fill: color, 'fill-opacity': '0.3' }
                            );
                        } catch (e) {
                            // Annotation CFI might not be valid for current section
                        }
                    });
                });

                // Keyboard navigation
                rendition.on('keyup', (e: KeyboardEvent) => {
                    if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
                        rendition.prev();
                    }
                    if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
                        rendition.next();
                    }
                });

                // Display at saved position or first chapter (skip cover)
                if (book.currentPosition) {
                    await rendition.display(book.currentPosition);
                } else {
                    // Try to skip cover and go to first chapter
                    const spineItems = epub.spine as any;
                    if (spineItems && spineItems.items && spineItems.items.length > 1) {
                        // Display second spine item (usually first chapter after cover)
                        await rendition.display(spineItems.items[1].href);
                    } else {
                        await rendition.display();
                    }
                }

                if (mounted) {
                    setIsLoading(false);

                    // Send TOC to parent - must wait for navigation to load
                    if (onTocLoaded) {
                        try {
                            // Wait for navigation to be fully loaded
                            await epub.loaded.navigation;

                            console.log('DEBUG: Navigation loaded:', epub.navigation);
                            console.log('DEBUG: TOC:', epub.navigation?.toc);

                            if (epub.navigation?.toc && epub.navigation.toc.length > 0) {
                                const convertToc = (items: NavItem[]): TocItem[] => {
                                    return items.map(item => ({
                                        label: item.label.trim(),
                                        href: item.href,
                                        subitems: item.subitems ? convertToc(item.subitems) : undefined,
                                    }));
                                };
                                console.log('TOC items count:', epub.navigation.toc.length);
                                onTocLoaded(convertToc(epub.navigation.toc));
                            } else {
                                console.log('DEBUG: No TOC items found');
                            }
                        } catch (navErr) {
                            console.warn('Could not load navigation/TOC:', navErr);
                        }
                    }
                }

            } catch (err) {
                console.error('Failed to initialize EPUB:', err);
                if (mounted) {
                    setError('Error al cargar el libro. Intenta de nuevo.');
                    setIsLoading(false);
                }
            }
        };

        initEpub();

        return () => {
            mounted = false;
            if (renditionRef.current) {
                renditionRef.current.destroy();
                renditionRef.current = null;
            }
            if (epubRef.current) {
                epubRef.current.destroy();
                epubRef.current = null;
            }
        };
    }, [book.id, book.fileBlob, book.currentPosition, settings.scrollMode, getReaderStyles, onLocationChange, onTextSelect, annotations]);

    // Update styles when settings change (without reinitializing)
    useEffect(() => {
        if (renditionRef.current) {
            renditionRef.current.themes.default(getReaderStyles());
        }
    }, [settings.fontFamily, settings.fontSize, settings.lineHeight, settings.letterSpacing, settings.textAlign, settings.marginHorizontal, settings.marginVertical, settings.theme, getReaderStyles]);

    return (
        <div className="epub-reader-wrapper">
            {isLoading && (
                <div className="epub-loading">
                    <div className="loading-spinner" />
                    <p>Cargando libro...</p>
                </div>
            )}

            {error && (
                <div className="epub-error">
                    <p>{error}</p>
                </div>
            )}

            <div
                className="epub-reader"
                ref={containerRef}
                style={{ visibility: isLoading ? 'hidden' : 'visible' }}
            />

            {/* Navigation buttons for paginated mode */}
            {!settings.scrollMode && !isLoading && (
                <>
                    <button
                        className="nav-btn nav-prev"
                        onClick={goPrev}
                        aria-label="Página anterior"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                            <polyline points="15 18 9 12 15 6" />
                        </svg>
                    </button>
                    <button
                        className="nav-btn nav-next"
                        onClick={goNext}
                        aria-label="Página siguiente"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                            <polyline points="9 18 15 12 9 6" />
                        </svg>
                    </button>
                </>
            )}

            <style jsx>{`
        .epub-reader-wrapper {
          position: relative;
          width: 100%;
          height: 100%;
          background: ${settings.theme === 'dark' ? '#1c1c1e' : settings.theme === 'sepia' ? '#f4ecd8' : '#ffffff'};
        }

        .epub-reader {
          width: 100%;
          height: 100%;
        }

        .epub-reader :global(iframe) {
          border: none !important;
        }

        .epub-loading,
        .epub-error {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: inherit;
          z-index: 10;
        }

        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid var(--color-border, #e0e0e0);
          border-top-color: var(--color-accent, #007aff);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        .epub-loading p,
        .epub-error p {
          margin-top: 16px;
          color: ${settings.theme === 'dark' ? '#a1a1a6' : '#6e6e73'};
        }

        .nav-btn {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 48px;
          height: 80px;
          background: rgba(0, 0, 0, 0.03);
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 0.2s, background 0.2s;
          z-index: 5;
          color: ${settings.theme === 'dark' ? '#a1a1a6' : '#6e6e73'};
        }

        .epub-reader-wrapper:hover .nav-btn {
          opacity: 1;
        }

        .nav-btn:hover {
          background: rgba(0, 0, 0, 0.08);
          color: ${settings.theme === 'dark' ? '#f5f5f7' : '#1d1d1f'};
        }

        .nav-prev {
          left: 0;
          border-radius: 0 8px 8px 0;
        }

        .nav-next {
          right: 0;
          border-radius: 8px 0 0 8px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
        </div>
    );
});

function getHighlightColor(color: Annotation['color']): string {
    const colors: Record<Annotation['color'], string> = {
        yellow: '#ffeb3b',
        green: '#4caf50',
        blue: '#2196f3',
        pink: '#e91e63',
        orange: '#ff9800',
    };
    return colors[color] || colors.yellow;
}
