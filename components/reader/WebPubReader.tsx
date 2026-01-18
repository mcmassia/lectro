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
        navigateTo: (hrefOrCfi: string) => {
            if (!manifest) return;

            // Handle CFI-like identifiers from annotations
            // Format: /api/readium/{bookId}/resource/OEBPS/Text/section.xhtml#text=...
            // OR: OEBPS/Text/section.xhtml#text=...
            let href = hrefOrCfi;

            // Extract resource path from API URL if present
            const apiMatch = hrefOrCfi.match(/\/api\/readium\/[^/]+\/resource\/(.+?)(?:#|$)/);
            if (apiMatch) {
                href = apiMatch[1];
            }

            // Remove fragment identifier (#text=... or #...)
            href = href.split('#')[0];

            // Find index in readingOrder
            const index = manifest.readingOrder.findIndex(link => {
                const linkHref = link.href.split('#')[0];
                // Try multiple matching strategies
                return linkHref === href ||
                    href.endsWith(linkHref) ||
                    linkHref.endsWith(href) ||
                    linkHref.includes(href) ||
                    href.includes(linkHref.replace(/^.*\/resource\//, ''));
            });

            if (index !== -1) {
                setCurrentResourceIndex(index);
            } else {
                console.warn('WebPubReader: Could not find resource for', hrefOrCfi, '-> extracted href:', href);
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

    // Helper function to get highlight color
    const getHighlightColor = (color: Annotation['color']): string => {
        const colors: Record<Annotation['color'], string> = {
            yellow: '#ffeb3b',
            green: '#4caf50',
            blue: '#2196f3',
            pink: '#e91e63',
            orange: '#ff9800',
        };
        return colors[color] || colors.yellow;
    };

    // Apply annotation highlights in the iframe content
    const applyAnnotationHighlights = useCallback(() => {
        if (!iframeRef.current || !iframeRef.current.contentDocument) return;
        if (!manifest) return;
        if (!annotations || annotations.length === 0) return;

        const doc = iframeRef.current.contentDocument;
        const body = doc.body;
        if (!body) return;

        // Get current resource href to filter relevant annotations
        const currentResource = manifest.readingOrder[currentResourceIndex];
        if (!currentResource) return;

        // Extract the resource path from current href for matching
        // Format: /api/readium/{bookId}/resource/OEBPS/Text/section.xhtml
        const currentHref = currentResource.href;
        const currentPathMatch = currentHref.match(/\/resource\/(.+?)(?:#|$)/);
        const currentPath = currentPathMatch ? currentPathMatch[1] : currentHref.split('#')[0];

        console.log('Current resource path:', currentPath);
        console.log('Total annotations:', annotations.length);

        // Filter annotations for the current chapter/resource with flexible matching
        const relevantAnnotations = annotations.filter(ann => {
            if (!ann.cfi) return false;

            // Extract path from annotation CFI
            const annPathMatch = ann.cfi.match(/\/resource\/(.+?)(?:#|$)/);
            const annPath = annPathMatch ? annPathMatch[1] : ann.cfi.split('#')[0];

            // Multiple matching strategies
            const matches =
                currentPath === annPath ||
                currentPath.endsWith(annPath) ||
                annPath.endsWith(currentPath) ||
                currentHref.includes(annPath) ||
                ann.cfi.includes(currentPath);

            if (matches) {
                console.log('Annotation matches current chapter:', ann.text?.substring(0, 30));
            }

            return matches;
        });

        console.log(`Found ${relevantAnnotations.length} relevant annotations for this chapter`);

        if (relevantAnnotations.length === 0) {
            // Try to apply ALL annotations if no path matching works (fallback)
            console.log('No path matches, trying to apply all annotations...');
        }

        // Use all annotations as fallback if none match by path
        const annotationsToApply = relevantAnnotations.length > 0 ? relevantAnnotations : annotations;

        // Add highlight styles if not already present
        let highlightStyle = doc.getElementById('lectro-highlight-styles');
        if (!highlightStyle) {
            highlightStyle = doc.createElement('style');
            highlightStyle.id = 'lectro-highlight-styles';
            highlightStyle.textContent = `
                .lectro-highlight {
                    border-radius: 2px;
                    padding: 0 2px;
                    margin: 0 -2px;
                    cursor: pointer;
                    transition: opacity 0.2s;
                }
                .lectro-highlight:hover {
                    opacity: 0.8;
                }
            `;
            doc.head.appendChild(highlightStyle);
        }

        // Helper function to normalize text for matching
        const normalizeText = (text: string): string => {
            return text
                .replace(/\s+/g, ' ')  // Normalize whitespace
                .replace(/[\u00A0]/g, ' ')  // Replace non-breaking spaces
                .trim();
        };

        // Helper function to find text range across multiple nodes
        const findTextRangeInBody = (searchText: string): Range | null => {
            const normalizedSearch = normalizeText(searchText);
            if (normalizedSearch.length < 3) return null;

            // Get all text content from body for matching
            const bodyText = body.innerText || body.textContent || '';
            const normalizedBody = normalizeText(bodyText);

            // Find where the search text starts in the normalized body
            const matchIndex = normalizedBody.indexOf(normalizedSearch);
            if (matchIndex === -1) {
                // Try with just the beginning for partial matches
                const shortSearch = normalizedSearch.substring(0, Math.min(50, normalizedSearch.length));
                const partialIndex = normalizedBody.indexOf(shortSearch);
                if (partialIndex === -1) return null;
            }

            // Use TreeWalker to map character positions to nodes
            const walker = doc.createTreeWalker(body, NodeFilter.SHOW_TEXT, null);
            let currentPos = 0;
            let startNode: Text | null = null;
            let startOffset = 0;
            let endNode: Text | null = null;
            let endOffset = 0;

            let node: Text | null;
            let charCount = 0;

            // Find target position accounting for whitespace normalization
            let targetStartPos = 0;
            let foundStart = false;

            // Build position mapping
            const textNodes: { node: Text; start: number; end: number; text: string }[] = [];
            while ((node = walker.nextNode() as Text | null)) {
                const nodeText = node.textContent || '';
                if (nodeText.trim()) {
                    textNodes.push({
                        node,
                        start: charCount,
                        end: charCount + nodeText.length,
                        text: nodeText
                    });
                    charCount += nodeText.length;
                }
            }

            // Search through concatenated text
            let concatenatedText = '';
            for (const tn of textNodes) {
                concatenatedText += tn.text;
            }

            const normalizedConcat = normalizeText(concatenatedText);
            const searchStart = normalizedConcat.indexOf(normalizedSearch);

            if (searchStart === -1) return null;

            // Map normalized position back to original position
            // This is approximate - we find nodes that cover the range
            let normalizedPos = 0;
            let originalPos = 0;
            let startOriginalPos = -1;
            let endOriginalPos = -1;

            for (let i = 0; i < concatenatedText.length && normalizedPos <= searchStart + normalizedSearch.length; i++) {
                const char = concatenatedText[i];

                if (normalizedPos === searchStart && startOriginalPos === -1) {
                    startOriginalPos = originalPos;
                }
                if (normalizedPos === searchStart + normalizedSearch.length) {
                    endOriginalPos = originalPos;
                    break;
                }

                // Advance normalized position (skip extra whitespace)
                if (!/\s/.test(char) || (normalizedPos === 0 || !/\s/.test(normalizeText(concatenatedText.substring(0, i)).slice(-1)))) {
                    if (!/\s/.test(char) || !/\s/.test(concatenatedText[i - 1] || '')) {
                        normalizedPos++;
                    }
                }
                originalPos++;
            }

            if (endOriginalPos === -1) {
                endOriginalPos = startOriginalPos + searchText.length;
            }

            // Find which text nodes contain start and end positions
            let runningPos = 0;
            for (const tn of textNodes) {
                const nodeEnd = runningPos + tn.text.length;

                if (!startNode && startOriginalPos >= runningPos && startOriginalPos < nodeEnd) {
                    startNode = tn.node;
                    startOffset = startOriginalPos - runningPos;
                }
                if (startNode && endOriginalPos <= nodeEnd) {
                    endNode = tn.node;
                    endOffset = Math.min(endOriginalPos - runningPos, tn.text.length);
                    break;
                }
                if (startNode && !endNode && endOriginalPos > nodeEnd) {
                    // End is in a later node, continue
                }

                runningPos = nodeEnd;
            }

            // If we found start but not end, use the start node's end
            if (startNode && !endNode) {
                endNode = startNode;
                endOffset = Math.min(startOffset + searchText.length, (startNode.textContent || '').length);
            }

            if (!startNode || !endNode) return null;

            try {
                const range = doc.createRange();
                range.setStart(startNode, Math.max(0, startOffset));
                range.setEnd(endNode, Math.min(endOffset, (endNode.textContent || '').length));
                return range;
            } catch (e) {
                console.warn('Could not create range:', e);
                return null;
            }
        };

        // For each annotation, try to find and highlight the text
        annotationsToApply.forEach(annotation => {
            const searchText = annotation.text;
            if (!searchText || searchText.length < 3) return;

            const color = getHighlightColor(annotation.color);

            // Check if already highlighted
            const existingHighlight = doc.querySelector(`[data-annotation-id="${annotation.id}"]`);
            if (existingHighlight) {
                console.log(`Already highlighted: "${searchText.substring(0, 30)}..."`);
                return;
            }

            // Try to find the text range
            const range = findTextRangeInBody(searchText);

            if (range) {
                try {
                    // Create highlight span that wraps the range content
                    const highlightSpan = doc.createElement('span');
                    highlightSpan.className = 'lectro-highlight';
                    highlightSpan.style.backgroundColor = color;
                    highlightSpan.style.opacity = '0.3';
                    highlightSpan.dataset.annotationId = annotation.id;
                    highlightSpan.title = annotation.note || 'Nota';

                    // Extract and wrap the contents
                    const contents = range.extractContents();
                    highlightSpan.appendChild(contents);
                    range.insertNode(highlightSpan);

                    console.log(`✓ Highlighted: "${searchText.substring(0, 30)}..."`);
                } catch (e) {
                    console.warn('Could not highlight annotation (may span complex elements):', e);
                }
            } else {
                console.log(`✗ Could not find text: "${searchText.substring(0, 30)}..."`);
            }
        });
    }, [annotations, manifest, currentResourceIndex]);

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

        // Apply annotation highlights after styles are injected
        setTimeout(() => {
            applyAnnotationHighlights();
        }, 100);

    }, [settings, handleIframeSelection, applyAnnotationHighlights]);

    // Re-inject styles when settings change
    useEffect(() => {
        injectStyles();
    }, [injectStyles]);

    // Re-apply annotation highlights when annotations change
    useEffect(() => {
        if (iframeRef.current?.contentDocument?.body) {
            applyAnnotationHighlights();
        }
    }, [annotations, applyAnnotationHighlights]);


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
                {/* Side Navigation - Left */}
                <button
                    className="side-nav-btn side-nav-prev"
                    onClick={goPrev}
                    disabled={currentResourceIndex === 0}
                    title="Capítulo anterior"
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                        <polyline points="15 18 9 12 15 6" />
                    </svg>
                </button>

                <iframe
                    ref={iframeRef}
                    src={currentResource.href}
                    className="reader-frame"
                    onLoad={injectStyles}
                    title="Book Content"
                />

                {/* Side Navigation - Right */}
                <button
                    className="side-nav-btn side-nav-next"
                    onClick={goNext}
                    disabled={currentResourceIndex === manifest.readingOrder.length - 1}
                    title="Capítulo siguiente"
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                        <polyline points="9 18 15 12 9 6" />
                    </svg>
                </button>
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
                
                /* Side Navigation Buttons */
                .side-nav-btn {
                    position: absolute;
                    top: 50%;
                    transform: translateY(-50%);
                    z-index: 50;
                    width: 48px;
                    height: 80px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(0, 0, 0, 0.1);
                    border: none;
                    cursor: pointer;
                    color: var(--color-text-secondary);
                    transition: all 0.2s ease;
                    opacity: 0.3;
                }
                .side-nav-btn:hover {
                    opacity: 1;
                    background: rgba(0, 0, 0, 0.2);
                    color: var(--color-text-primary);
                }
                .side-nav-btn:disabled {
                    opacity: 0.1;
                    cursor: not-allowed;
                }
                .side-nav-prev {
                    left: 0;
                    border-radius: 0 8px 8px 0;
                }
                .side-nav-next {
                    right: 0;
                    border-radius: 8px 0 0 8px;
                }
                
                /* Theme-aware side nav colors */
                ${settings.theme === 'dark' ? `
                    .side-nav-btn {
                        background: rgba(255, 255, 255, 0.05);
                        color: rgba(255, 255, 255, 0.5);
                    }
                    .side-nav-btn:hover {
                        background: rgba(255, 255, 255, 0.15);
                        color: rgba(255, 255, 255, 0.9);
                    }
                ` : settings.theme === 'sepia' ? `
                    .side-nav-btn {
                        background: rgba(92, 75, 55, 0.1);
                        color: rgba(92, 75, 55, 0.5);
                    }
                    .side-nav-btn:hover {
                        background: rgba(92, 75, 55, 0.2);
                        color: rgba(92, 75, 55, 0.9);
                    }
                ` : ''}

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
