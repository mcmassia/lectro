'use client';

import { useState, useEffect } from 'react';
import { useLibraryStore, useAppStore } from '@/stores/appStore';
import { SidebarGoalsWidget } from '@/components/goals/SidebarGoalsWidget';
import { ChevronRight, ChevronLeft, Info, BrainCircuit, Eye, Sparkles, PanelRightClose } from 'lucide-react';
import { getAllTags, db, XRayData, Book } from '@/lib/db';
import { usePathname, useRouter } from 'next/navigation';
import { generateXRayAction } from '@/app/actions/ai';



export function RightSidebar() {
    const { books, tags, setTags, setView, setActiveCategory, selectedBookId, currentView } = useLibraryStore();
    const { currentUser, setXrayModalData, mobileRightSidebarOpen, setMobileRightSidebarOpen } = useAppStore();
    const [localCollapsed, setLocalCollapsed] = useState(false);
    // Auto-collapse if in details or xray view
    const isCollapsed = localCollapsed || currentView === 'book-details' || currentView === 'xray';
    const pathname = usePathname();
    const router = useRouter();

    // X-Ray State
    const [xrayData, setXrayData] = useState<XRayData | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    // Removed local showXRayModal state


    useEffect(() => {
        getAllTags().then(setTags);
    }, [setTags]);

    // Fetch X-Ray data when selected book changes
    useEffect(() => {
        if (!selectedBookId) {
            setXrayData(null);
            return;
        }

        const fetchXRay = async () => {
            try {
                const data = await db.xrayData.where('bookId').equals(selectedBookId).first();
                setXrayData(data || null);
            } catch (e) {
                console.error("Failed to load X-Ray data", e);
            }
        };
        fetchXRay();
    }, [selectedBookId]);

    if (pathname?.startsWith('/reader') || pathname === '/login') return null;

    const uniqueCategories = new Set(books.flatMap(b => b.metadata?.categories || []));

    const stats = {
        books: books.length,
        authors: new Set(books.map(b => b.author)).size,
        tags: uniqueCategories.size
    };

    const handleGenerateXRay = async () => {
        if (!selectedBookId) return;
        const book = books.find(b => b.id === selectedBookId);
        if (!book) return;

        setIsGenerating(true);
        try {
            // 1. Extract content (Simplified for now - we might want to move this to a shared worker/helper)
            // We need extraction logic similar to indexer.ts but focused on "first chunk" or "representative chunk"
            // For X-Ray we typically want the first 60k chars or so.
            // Re-using logic:
            // 1. Extract content with robust fallback
            let bookContent: ArrayBuffer;

            if (book.fileBlob) {
                bookContent = await book.fileBlob.arrayBuffer();
            } else if (book.isOnServer && book.filePath) {
                // Download from server using the stream API
                console.log('Downloading book from server for X-Ray...');
                const encodedPath = book.filePath.split('/').map(encodeURIComponent).join('/');
                const response = await fetch(`/api/library/stream/${encodedPath}`);
                if (!response.ok) {
                    throw new Error(`Failed to download book from server: ${response.status}`);
                }
                bookContent = await response.arrayBuffer();
            } else {
                alert("No se pudo obtener el contenido del libro (falta blob local y ruta remota).");
                setIsGenerating(false);
                return;
            }

            // Robust Extraction using JSZip (matches ReaderSidebar logic)
            // Import epubjs dynamically just to get the spine/structure info easily
            const ePub = (await import('epubjs')).default;
            const bookInstance = ePub(bookContent);
            await bookInstance.ready;

            let fullText = '';
            // @ts-ignore
            const spine = bookInstance.spine;
            const sections: any[] = [];
            spine.each((section: any) => sections.push(section));

            const limit = 60000;
            const JSZip = (await import('jszip')).default;
            const zip = await JSZip.loadAsync(bookContent);

            for (const item of sections) {
                if (fullText.length >= limit) break;

                let text = '';
                const href = item.href;

                try {
                    let zipFile = zip.file(href);
                    if (!zipFile) {
                        const cleanHref = href.replace(/^\//, '');
                        zipFile = zip.file(cleanHref);
                    }
                    if (!zipFile) {
                        const files = Object.keys(zip.files);
                        const match = files.find(f => f.endsWith(href) || href.endsWith(f));
                        if (match) zipFile = zip.file(match);
                    }

                    if (zipFile) {
                        const rawContent = await zipFile.async('string');
                        // Simple robust cleanup without DOM if possible, but DOMParser is fine in browser
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(rawContent, 'text/html');
                        text = (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
                    }
                } catch (e) {
                    console.warn(`X-Ray: Extraction failed for ${href}`, e);
                }

                if (text) {
                    fullText += text + '\n\n';
                }
            }
            bookInstance.destroy();
            const content = fullText;

            // 2. Generate
            const result = await generateXRayAction(content, book.title);

            if (result.success && result.data) {
                const newXray: XRayData = {
                    id: crypto.randomUUID(),
                    bookId: book.id,
                    generatedAt: new Date(),
                    language: result.data.language,
                    summary: result.data.summary,
                    plot: result.data.plot,
                    keyPoints: result.data.keyPoints,
                    characters: result.data.characters.map((c: any) => ({ ...c, mentions: [] })),
                    places: result.data.places.map((p: any) => ({ ...p, mentions: [] })),
                    terms: result.data.terms.map((t: any) => ({ ...t, mentions: [] })),
                };
                await db.xrayData.add(newXray);
                setXrayData(newXray);
            } else {
                alert("Error generando X-Ray: " + result.error);
            }

        } catch (e) {
            console.error(e);
            alert("Error general al generar ADN");
        } finally {
            setIsGenerating(false);
        }
    };

    const selectedBook = books.find(b => b.id === selectedBookId);

    return (
        <>
            {/* Mobile Overlay */}
            {mobileRightSidebarOpen && (
                <div
                    className="mobile-overlay"
                    onClick={() => setMobileRightSidebarOpen(false)}
                />
            )}
            <aside className={`right-sidebar ${isCollapsed ? 'collapsed' : ''} ${mobileRightSidebarOpen ? 'mobile-open' : ''}`}>
                <div className="mobile-header">
                    <h3>Panel Lateral</h3>
                    <button className="close-btn" onClick={() => setMobileRightSidebarOpen(false)}>
                        <PanelRightClose size={20} />
                    </button>
                </div>
                <button
                    className="collapse-btn"
                    onClick={() => setLocalCollapsed(!localCollapsed)}
                    title={isCollapsed ? "Expandir" : "Colapsar"}
                >
                    {isCollapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
                </button>

                <div className="sidebar-content">

                    {/* Metas de Lectura Section */}
                    <div className="sidebar-section goals-section">
                        <div className="section-header clickable" onClick={() => router.push('/goals')}>
                            <h3 className="heading-4">Metas de Lectura</h3>
                            <ChevronRight size={14} className="link-icon" />
                        </div>

                        {!isCollapsed && (
                            <div className="goals-compact">
                                <SidebarGoalsWidget />
                            </div>
                        )}
                    </div>

                    {/* Stats Section */}
                    <div className="sidebar-section">
                        <div className="section-header">
                            <h3 className="section-title">Números</h3>
                        </div>

                        {!isCollapsed && (
                            <div className="stats-grid">
                                <button className="stat-card blue clickable" onClick={() => {
                                    setView('library');
                                    setActiveCategory('all');
                                }}>
                                    <span className="stat-value">{stats.books}</span>
                                    <span className="stat-label">Libros</span>
                                </button>
                                <button className="stat-card purple clickable" onClick={() => {
                                    setView('library');
                                    setActiveCategory('authors' as any);
                                }}>
                                    <span className="stat-value">{stats.authors}</span>
                                    <span className="stat-label">Autores</span>
                                </button>
                                <button className="stat-card green clickable" onClick={() => {
                                    setView('tags');
                                }}>
                                    <span className="stat-value">{stats.tags}</span>
                                    <span className="stat-label">Etiquetas</span>
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Book DNA / X-Ray */}
                    <div className="sidebar-section xray-section">
                        <div className="section-header">
                            <h3 className="section-title">ADN del Libro</h3>
                            <span className="badge-ai">AI</span>
                        </div>

                        {!isCollapsed && (
                            <div className="xray-container">
                                {selectedBookId ? (
                                    xrayData ? (
                                        <div className="xray-content-preview animate-fade-in">
                                            <p className="xray-summary-clamp">
                                                {xrayData.summary}
                                            </p>
                                            <button
                                                className="btn-view-more"
                                                onClick={(e) => {
                                                    console.log('RightSidebar: Navigating to X-Ray View');
                                                    e.stopPropagation();
                                                    setView('xray');
                                                }}
                                            >
                                                <Eye size={14} />
                                                Ver todo
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="xray-empty-state animate-fade-in">
                                            <p className="empty-text">
                                                {selectedBook ? `Genera el ADN de "${selectedBook.title}"` : "Selecciona un libro"}
                                            </p>
                                            <button
                                                className="btn-generate-ai"
                                                onClick={handleGenerateXRay}
                                                disabled={isGenerating || !selectedBook}
                                            >
                                                {isGenerating ? (
                                                    <>
                                                        <Sparkles size={14} className="animate-spin-slow" />
                                                        Generando...
                                                    </>
                                                ) : (
                                                    <>
                                                        <BrainCircuit size={14} />
                                                        Generar ADN
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    )
                                ) : (
                                    <div className="no-selection-state">
                                        <p>Selecciona un libro de la biblioteca para ver su ADN.</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>


                <style jsx>{`
                .mobile-header {
                    display: none; /* Hidden by default (Desktop) */
                    align-items: center;
                    justify-content: space-between;
                    padding: 16px;
                    border-bottom: 1px solid var(--color-border);
                    background: var(--color-bg-tertiary);
                }

                .right-sidebar {
                    width: 300px;
                    border-left: 1px solid var(--color-divider);
                    background: var(--color-bg-secondary);
                    display: flex;
                    flex-direction: column;
                    position: relative;
                    transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    height: calc(100vh - 64px);
                    flex-shrink: 0;
                    overflow: hidden; /* Main vertical scroll handled by sidebar-content */
                }

                .right-sidebar.collapsed {
                    width: 24px;
                    border-left: 1px solid var(--color-divider);
                }
               
                .right-sidebar.collapsed .sidebar-content {
                    display: none;
                }

                .sidebar-content {
                    flex: 1;
                    overflow-y: auto;
                    padding: 24px;
                    display: flex;
                    flex-direction: column;
                    gap: 32px;
                }

                .sidebar-section {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .section-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }

                .heading-4 {
                    font-size: 16px;
                    font-weight: 600;
                    color: var(--color-text-primary);
                }

                .section-subheader {
                    font-size: 13px;
                    color: var(--color-text-secondary);
                }
                
                .section-title {
                    font-size: 13px;
                    font-weight: 600;
                    color: var(--color-text-secondary);
                }

                .info-icon {
                    color: var(--color-text-tertiary);
                    cursor: help;
                }
                
                .badge-ai {
                    font-size: 10px;
                    font-weight: 700;
                    color: white;
                    background: linear-gradient(135deg, #a855f7, #ec4899);
                    padding: 2px 6px;
                    border-radius: 4px;
                }

                .rings-wrapper {
                    display: flex;
                    justify-content: center;
                    padding: 12px 0;
                }

                .section-header.clickable {
                    cursor: pointer;
                    transition: all 0.2s;
                    padding: 4px 0;
                    margin: -4px 0;
                }

                .section-header.clickable:hover {
                    color: var(--color-accent);
                }

                .section-header.clickable:hover .heading-4 {
                    color: var(--color-accent);
                }

                .link-icon {
                    color: var(--color-text-tertiary);
                    transition: transform 0.2s;
                }

                .section-header.clickable:hover .link-icon {
                    color: var(--color-accent);
                    transform: translateX(2px);
                }

                .goals-compact {
                    padding: var(--space-2) 0;
                }

                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 8px;
                }

                .stat-card {
                    background: var(--color-bg-tertiary);
                    border-radius: 12px;
                    padding: 12px 8px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 4px;
                }
                
                .stat-card.blue .stat-value { color: #3b82f6; }
                .stat-card.purple .stat-value { color: #a855f7; }
                .stat-card.green .stat-value { color: #10b981; }

                .stat-card.clickable {
                    cursor: pointer;
                    transition: transform 0.2s, background-color 0.2s;
                    border: none;
                }

                .stat-card.clickable:hover {
                    transform: translateY(-2px);
                    background: var(--color-bg-elevated);
                }

                .stat-value {
                    font-size: 18px;
                    font-weight: 700;
                }

                .stat-label {
                    font-size: 10px;
                    color: var(--color-text-secondary);
                    text-transform: lowercase;
                }

                .xray-container {
                    background: var(--color-bg-tertiary);
                    border-radius: 12px;
                    padding: 16px;
                    min-height: 120px;
                }

                .xray-summary-clamp {
                    font-size: 13px;
                    color: var(--color-text-secondary);
                    line-height: 1.6;
                    /* Removed clamping to show full text as requested */
                    /* display: -webkit-box; */
                    /* -webkit-line-clamp: 4; */
                    /* -webkit-box-orient: vertical; */
                    /* overflow: hidden; */
                    margin-bottom: 12px;
                }
                
                .btn-view-more {
                    width: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                    padding: 8px;
                    border-radius: 8px;
                    background: var(--color-bg-elevated);
                    color: var(--color-text-primary);
                    border: 1px solid var(--color-border);
                    font-size: 12px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                    position: relative;
                    z-index: 10;
                }
                
                .btn-view-more:hover {
                    background: var(--color-bg-secondary);
                }

                .xray-empty-state, .no-selection-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    text-align: center;
                    gap: 12px;
                    height: 100%;
                    padding: 8px;
                }

                .no-selection-state p {
                     font-size: 12px;
                     color: var(--color-text-tertiary);
                }

                .empty-text {
                    font-size: 13px;
                    color: var(--color-text-secondary);
                    line-height: 1.4;
                }

                .btn-generate-ai {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    background: linear-gradient(135deg, #a855f7, #ec4899);
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 20px;
                    font-size: 12px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: transform 0.2s, opacity 0.2s;
                    box-shadow: 0 4px 6px -1px rgba(168, 85, 247, 0.4);
                }

                .btn-generate-ai:hover:not(:disabled) {
                    transform: scale(1.05);
                }
                
                .btn-generate-ai:disabled {
                    opacity: 0.7;
                    cursor: not-allowed;
                }

                .animate-spin-slow {
                    animation: spin 3s linear infinite;
                }

                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                .collapse-btn {
                    position: absolute;
                    top: 12px;
                    left: -12px; 
                    width: 24px;
                    height: 24px;
                    background: var(--color-bg-elevated);
                    border: 1px solid var(--color-divider);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    z-index: 10;
                    color: var(--color-text-secondary);
                    box-shadow: var(--shadow-sm);
                }

                @media (max-width: 1024px) {
                    .right-sidebar {
                        position: fixed;
                        z-index: 900; /* Below TopBar (1000) */
                        height: calc(100vh - 64px);
                        top: 64px; /* Below TopBar */
                        right: 0;
                        bottom: 0;
                        width: 100vw; /* Full screen width below header */
                        transform: translateX(100%);
                        background: var(--color-bg-secondary);
                        box-shadow: none;
                        border-left: none;
                        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    }

                    /* Reset .collapsed specific styles for mobile */
                    .right-sidebar.collapsed {
                        width: 100vw !important; 
                        border: none;
                    }
                    
                    .right-sidebar.mobile-open {
                        transform: translateX(0);
                        display: flex;
                        flex-direction: column; /* Ensure header stacks */
                    }

                    .mobile-header {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        padding: 16px;
                        border-bottom: 1px solid var(--color-border);
                        background: var(--color-bg-tertiary);
                    }

                    .mobile-header h3 {
                        font-size: 16px;
                        font-weight: 600;
                        margin: 0;
                        color: var(--color-text-primary);
                    }

                    .close-btn {
                        background: transparent;
                        border: none;
                        color: var(--color-text-secondary);
                        cursor: pointer;
                        padding: 4px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }

                    .right-sidebar .collapse-btn {
                        display: none; /* Hide desktop collapse button on mobile */
                    }
                }
                


                .mobile-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.5);
                    z-index: 100;
                    backdrop-filter: blur(2px);
                    animation: fadeIn 0.2s ease-out;
                }
                
                @media (min-width: 1024px) {
                    .right-sidebar {
                        display: flex;
                    }
                }
                
                .animate-fade-in {
                    animation: fadeIn 0.3s ease-out;
                }
                
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

            `}</style>
            </aside >
        </>
    );
}

