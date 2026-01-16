'use client';

import { useEffect, useRef, useCallback, useState, forwardRef, useImperativeHandle } from 'react';
import { Book, Annotation, ReaderSettings } from '@/lib/db';
import { ReadiumManifest, ReadiumLink } from '@/lib/readium/types';
import { TocItem } from './EpubReader'; // Reuse or move type

interface WebPubReaderProps {
    book: Book;
    onLocationChange: (cfi: string, page: number, total: number, chapter: string) => void;
    onTextSelect: (text: string, cfi: string, rect: { x: number; y: number }) => void;
    onTocLoaded?: (toc: TocItem[]) => void;
    annotations: Annotation[];
    settings: ReaderSettings;
}

export interface WebPubReaderRef {
    navigateTo: (href: string) => void;
}

export const WebPubReader = forwardRef<WebPubReaderRef, WebPubReaderProps>(function WebPubReader({
    book,
    onLocationChange,
    onTextSelect,
    onTocLoaded,
    annotations,
    settings,
}, ref) {
    const [manifest, setManifest] = useState<ReadiumManifest | null>(null);
    const [currentResourceIndex, setCurrentResourceIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    // Fetch Manifest
    useEffect(() => {
        let mounted = true;
        async function fetchManifest() {
            try {
                setIsLoading(true);
                const res = await fetch(`/api/readium/${book.id}/manifest`);
                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    throw new Error(errData.error || `Failed to load manifest: ${res.status}`);
                }
                const data = await res.json();

                if (mounted) {
                    setManifest(data);

                    // Restore position if available
                    if (book.currentPosition) {
                        // TODO: Better CFI/Href parsing to find index
                        // For now, if currentPosition looks like a URL from our API, find it
                        // Or if it's a simple index
                        // book.currentPosition might be an epub cfi from previous reader, which won't work directy.
                        // We'll default to 0 for migration safety unless we can map it.
                        const index = data.readingOrder.findIndex((link: ReadiumLink) =>
                            book.currentPosition.includes(link.href)
                        );
                        if (index !== -1) setCurrentResourceIndex(index);
                    }
                    setIsLoading(false);
                }
            } catch (err: any) {
                console.error(err);
                if (mounted) {
                    setError(err.message || 'Error loading book manifest.');
                }
                setIsLoading(false);
            }
        }
        fetchManifest();
        return () => { mounted = false; };
    }, [book.id]);

    // Expose navigation
    useImperativeHandle(ref, () => ({
        navigateTo: (href: string) => {
            if (!manifest) return;
            // Href might be full URL or relative
            // Find index in readingOrder
            const index = manifest.readingOrder.findIndex(link =>
                link.href === href || href.endsWith(link.href) || link.href.endsWith(href)
            );
            if (index !== -1) {
                setCurrentResourceIndex(index);
            }
        },
    }));

    // Handle TOC Loading
    useEffect(() => {
        if (manifest && onTocLoaded && manifest.toc) {
            // Convert Readium TOC to our generic TocItem
            const convertToc = (items: ReadiumLink[]): TocItem[] => {
                return items.map(item => ({
                    label: item.title || 'Untitled',
                    href: item.href,
                    subitems: item.children ? convertToc(item.children) : undefined
                }));
            };
            onTocLoaded(convertToc(manifest.toc));
        }
    }, [manifest, onTocLoaded]);


    // Handle text selection in iframe
    const handleIframeSelection = useCallback(() => {
        if (!iframeRef.current || !iframeRef.current.contentDocument) return;

        const doc = iframeRef.current.contentDocument;
        const selection = doc.getSelection();

        if (!selection || selection.isCollapsed) return;

        const text = selection.toString().trim();
        if (!text) return;

        try {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();

            // Get the iframe position
            const iframeRect = iframeRef.current.getBoundingClientRect();

            // Convert iframe-relative coords to viewport coords
            const viewportX = iframeRect.left + rect.left + (rect.width / 2);
            const viewportY = iframeRect.top + rect.top;

            // Generate a CFI-like identifier using the current resource href and text content
            const currentResource = manifest?.readingOrder[currentResourceIndex];
            const cfiLike = `${currentResource?.href || 'unknown'}#text=${encodeURIComponent(text.substring(0, 50))}`;

            console.log('WebPub text selected:', text.substring(0, 50), 'at', viewportX, viewportY);
            onTextSelect(text, cfiLike, { x: viewportX, y: viewportY });
        } catch (err) {
            console.warn('Could not get selection rect:', err);
        }
    }, [manifest, currentResourceIndex, onTextSelect]);

    // Inject Styles when iframe loads or settings change
    const injectStyles = useCallback(() => {
        if (!iframeRef.current || !iframeRef.current.contentDocument) return;

        const doc = iframeRef.current.contentDocument;
        const body = doc.body;

        if (!body) return;

        // Apply Theme
        const themeColors = {
            light: { bg: '#ffffff', text: '#1d1d1f' },
            sepia: { bg: '#f4ecd8', text: '#5c4b37' },
            dark: { bg: '#1c1c1e', text: '#f5f5f7' },
        };
        const theme = settings.theme || 'light';
        const colors = themeColors[theme] || themeColors.light;

        body.style.backgroundColor = colors.bg;
        body.style.color = colors.text;
        body.style.fontFamily = settings.fontFamily;
        body.style.fontSize = `${settings.fontSize}px`;
        body.style.lineHeight = String(settings.lineHeight);
        body.style.textAlign = settings.textAlign;

        // Add padding
        body.style.padding = `${settings.marginVertical}px ${settings.marginHorizontal}px`;
        body.style.maxWidth = '900px';
        body.style.margin = '0 auto';

        // Images max width and selection styling
        const styleEl = doc.createElement('style');
        styleEl.textContent = `
            img { max-width: 100%; height: auto; }
            a { color: inherit; }
            ::selection { background-color: rgba(0, 122, 255, 0.3); }
        `;
        doc.head.appendChild(styleEl);

        // Add mouseup listener for text selection
        doc.addEventListener('mouseup', handleIframeSelection);

    }, [settings, handleIframeSelection]);

    // Re-inject styles when settings change
    useEffect(() => {
        injectStyles();
    }, [injectStyles]);


    // Navigation Handlers
    const goPrev = () => {
        if (currentResourceIndex > 0) {
            setCurrentResourceIndex(prev => prev - 1);
        }
    };

    const goNext = () => {
        if (manifest && currentResourceIndex < manifest.readingOrder.length - 1) {
            setCurrentResourceIndex(prev => prev + 1);
        }
    };

    // Update location info
    useEffect(() => {
        if (!manifest) return;

        const currentLink = manifest.readingOrder[currentResourceIndex];
        const total = manifest.readingOrder.length;

        // Simple progress based on chapter count for now
        // Real progress needs character count or similar
        const progress = currentResourceIndex + 1;

        // Notify parent
        // Passing href as CFI equivalent for now
        onLocationChange(
            currentLink.href,
            progress,
            total,
            currentLink.title || `Chapter ${progress}`
        );

    }, [currentResourceIndex, manifest, onLocationChange]);


    if (isLoading) return <div className="loading">Loading Readium...</div>;
    if (error) return <div className="error">{error}</div>;
    if (!manifest) return null;

    const currentResource = manifest.readingOrder[currentResourceIndex];

    return (
        <div className="webpub-reader">
            <div className="frame-container">
                <iframe
                    ref={iframeRef}
                    src={currentResource.href}
                    className="reader-frame"
                    onLoad={injectStyles}
                    title="Book Content"
                />
            </div>

            <div className="nav-controls">
                <button
                    className="nav-btn prev"
                    onClick={goPrev}
                    disabled={currentResourceIndex === 0}
                >
                    ←
                </button>
                <div className="progress-info">
                    {currentResourceIndex + 1} / {manifest.readingOrder.length}
                </div>
                <button
                    className="nav-btn next"
                    onClick={goNext}
                    disabled={currentResourceIndex === manifest.readingOrder.length - 1}
                >
                    →
                </button>
            </div>

            <style jsx>{`
                .webpub-reader {
                    width: 100%;
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                    background: ${settings.theme === 'dark' ? '#1c1c1e' : settings.theme === 'sepia' ? '#f4ecd8' : '#ffffff'};
                }
                .frame-container {
                    flex: 1;
                    overflow: hidden;
                    position: relative;
                }
                .reader-frame {
                    width: 100%;
                    height: 100%;
                    border: none;
                }
                .nav-controls {
                    height: 50px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 20px;
                    border-top: 1px solid var(--color-border);
                    background: var(--color-bg-elevated);
                }
                .nav-btn {
                    padding: 8px 16px;
                    border-radius: 4px;
                    border: 1px solid var(--color-border);
                    background: var(--color-bg-secondary);
                    cursor: pointer;
                }
                .nav-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                .loading, .error {
                     display: flex;
                     align-items: center;
                     justify-content: center;
                     height: 100%;
                     color: var(--color-text-secondary);
                }
            `}</style>
        </div>
    );
});
