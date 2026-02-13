import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
    Book,
    Annotation,
    AppSettings,
    ReaderSettings,
    defaultAppSettings,
    defaultReaderSettings,
    Tag,
    BookCategory,
    UserBookRating,
    getAllBooks,
    getRecentBooks,
    getAllTags,
    db,
    User,
    getBooksForUser,
    getReadingBooksForUser,
    getAnnotationsForUserBook,
    updateUserBookData
} from '@/lib/db';
import { syncData } from '@/lib/sync';

// ===================================
// App Store Types
// ===================================

interface AppState {
    // Auth
    currentUser: User | null;
    login: (user: User) => void;
    logout: () => void;

    // Theme
    theme: 'light' | 'dark' | 'system';
    resolvedTheme: 'light' | 'dark';
    setTheme: (theme: 'light' | 'dark' | 'system') => void;

    // Library
    libraryPath: string | null;
    setLibraryPath: (path: string) => void;

    // Onboarding
    onboardingComplete: boolean;
    setOnboardingComplete: (complete: boolean) => void;

    // Currently reading
    currentBookId: string | null;
    setCurrentBookId: (id: string | null) => void;

    // Reader settings
    readerSettings: ReaderSettings;
    updateReaderSettings: (settings: Partial<ReaderSettings>) => void;

    // Reading goal
    dailyReadingGoal: number;
    setDailyReadingGoal: (pages: number) => void;

    // UI State
    sidebarCollapsed: boolean;
    toggleSidebar: () => void;
    mobileMenuOpen: boolean;
    setMobileMenuOpen: (open: boolean) => void;
    toggleMobileMenu: () => void;
    mobileRightSidebarOpen: boolean;
    setMobileRightSidebarOpen: (open: boolean) => void;
    toggleMobileRightSidebarOpen: () => void;

    // Reader sidebar
    readerSidebarOpen: boolean;
    readerSidebarTab: 'toc' | 'annotations' | 'xray' | 'settings';
    setReaderSidebarOpen: (open: boolean) => void;
    setReaderSidebarTab: (tab: 'toc' | 'annotations' | 'xray' | 'settings') => void;

    // AI Settings
    aiModel: string;
    setAIModel: (model: string) => void;

    // Import Modal
    showImportModal: boolean;
    setShowImportModal: (show: boolean) => void;

    // Global X-Ray Modal
    xrayModalData: any | null; // using any to avoid circular dependency or import issues if straightforward import fails, but ideally XRayData
    setXrayModalData: (data: any | null) => void;
}

// ===================================
// App Store
// ===================================

export const useAppStore = create<AppState>()(
    persist(
        (set, get) => ({
            // Auth
            currentUser: null,
            login: (user) => {
                set({ currentUser: user });
                // Reload library for new user
                useLibraryStore.getState().loadBooks();
            },
            logout: () => {
                set({ currentUser: null });
                useLibraryStore.getState().setBooks([]);
            },

            // Theme
            theme: 'system',
            resolvedTheme: 'light',
            setTheme: (theme) => {
                const resolved = theme === 'system'
                    ? (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
                    : theme;
                set({ theme, resolvedTheme: resolved });
                if (typeof document !== 'undefined') {
                    document.documentElement.setAttribute('data-theme', resolved);
                }
            },

            // Library
            libraryPath: null,
            setLibraryPath: (path) => set({ libraryPath: path }),

            // Onboarding
            onboardingComplete: false,
            setOnboardingComplete: (complete) => set({ onboardingComplete: complete }),

            // Currently reading
            currentBookId: null,
            setCurrentBookId: (id) => set({ currentBookId: id }),

            // Reader settings
            readerSettings: defaultReaderSettings,
            updateReaderSettings: (settings) => set((state) => ({
                readerSettings: { ...state.readerSettings, ...settings }
            })),

            // Reading goal
            dailyReadingGoal: 30,
            setDailyReadingGoal: (pages) => set({ dailyReadingGoal: pages }),

            // UI State
            sidebarCollapsed: false,
            toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
            mobileMenuOpen: false,
            setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),
            toggleMobileMenu: () => set((state) => ({ mobileMenuOpen: !state.mobileMenuOpen })),
            mobileRightSidebarOpen: false,
            setMobileRightSidebarOpen: (open) => set({ mobileRightSidebarOpen: open }),
            toggleMobileRightSidebarOpen: () => set((state) => ({ mobileRightSidebarOpen: !state.mobileRightSidebarOpen })),

            // Reader sidebar
            readerSidebarOpen: true,
            readerSidebarTab: 'toc',
            setReaderSidebarOpen: (open) => set({ readerSidebarOpen: open }),
            setReaderSidebarTab: (tab) => set({ readerSidebarTab: tab }),

            // AI Settings
            aiModel: 'gemini-2.5-flash',
            setAIModel: (model) => set({ aiModel: model }),

            // Import Modal
            showImportModal: false,
            setShowImportModal: (show) => set({ showImportModal: show }),

            // Global X-Ray Modal
            xrayModalData: null,
            setXrayModalData: (data) => set({ xrayModalData: data }),
        }),
        {
            name: 'lectro-storage',
            partialize: (state) => ({
                currentUser: state.currentUser,
                theme: state.theme,
                libraryPath: state.libraryPath,
                onboardingComplete: state.onboardingComplete,
                readerSettings: state.readerSettings,
                dailyReadingGoal: state.dailyReadingGoal,
                sidebarCollapsed: state.sidebarCollapsed,
                readerSidebarOpen: state.readerSidebarOpen,
                readerSidebarTab: state.readerSidebarTab,
                aiModel: state.aiModel,
            }),
        }
    )
);

// ===================================
// Library Store (for books)
// ===================================

interface LibraryState {
    books: Book[];
    isLoading: boolean;
    isFullyLoaded: boolean;
    searchQuery: string;
    sortBy: 'title' | 'author' | 'lastRead' | 'addedDate' | 'progress' | 'fileSize' | 'relevance';
    activeCategory: 'all' | 'recientes' | 'unread' | 'interesting' | 'planToRead' | 'reading' | 'completed' | 're_read' | 'favorites' | 'authors' | 'no-metadata' | 'no-cover';
    activeFormat: 'all' | 'epub' | 'pdf';
    activeTag: string | null;
    activeThematicCategory: BookCategory | null;  // Filtro por categoría temática
    activeUserRating: UserBookRating | null;      // Filtro por valoración personal
    xrayKeywords: Record<string, string>;         // Keywords for search from X-Ray
    tags: Tag[];
    sortOrder: 'asc' | 'desc';
    currentView: 'library' | 'tags' | 'xray' | 'book-details' | 'author-details';

    setBooks: (books: Book[]) => void;
    addBook: (book: Book) => void;
    updateBook: (id: string, updates: Partial<Book>) => void;
    removeBook: (id: string) => void;
    setSearchQuery: (query: string) => void;
    setSortBy: (sort: 'title' | 'author' | 'lastRead' | 'addedDate' | 'progress' | 'fileSize' | 'relevance') => void;
    setActiveCategory: (category: 'all' | 'recientes' | 'unread' | 'interesting' | 'planToRead' | 'reading' | 'completed' | 're_read' | 'favorites' | 'authors') => void;
    setActiveFormat: (format: 'all' | 'epub' | 'pdf') => void;
    setActiveTag: (tag: string | null) => void;
    setTags: (tags: Tag[]) => void;
    addTag: (tag: Tag) => void; // For UI update after DB add
    updateTag: (id: string, updates: Partial<Tag>) => void;
    removeTag: (id: string) => void;
    setSortOrder: (order: 'asc' | 'desc') => void;
    setIsLoading: (loading: boolean) => void;
    setView: (view: 'library' | 'tags' | 'xray' | 'book-details' | 'author-details') => void;
    setActiveThematicCategory: (cat: BookCategory | null) => void;
    setActiveUserRating: (rating: UserBookRating | null) => void;
    loadBooks: () => Promise<void>;
    loadRecentBooks: () => Promise<void>;
    syncMetadata: () => Promise<void>;
    loadXRayKeywords: () => Promise<void>;

    selectedBookId: string | null;
    setSelectedBookId: (id: string | null) => void;

    selectedAuthor: string | null;
    setSelectedAuthor: (author: string | null) => void;

    // Computed
    filteredBooks: () => Book[];
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
    books: [],
    isLoading: true,
    isFullyLoaded: false,
    searchQuery: '',
    sortBy: 'relevance',
    activeCategory: 'recientes',
    activeFormat: 'all',
    activeTag: null,
    activeThematicCategory: null,
    activeUserRating: null,
    xrayKeywords: {},
    tags: [],
    sortOrder: 'desc',
    currentView: 'library',
    selectedBookId: null,
    selectedAuthor: null,

    setBooks: (books) => set({ books, isLoading: false }),
    setSelectedBookId: (id) => set({ selectedBookId: id }),
    setSelectedAuthor: (author) => set({ selectedAuthor: author }),
    loadBooks: async () => {
        set({ isLoading: true });
        try {
            const currentUser = useAppStore.getState().currentUser;
            let books: Book[] = [];

            if (currentUser) {
                // Load books with user specific data
                books = await getBooksForUser(currentUser.id);
            } else {
                // Fallback / No user? Should probably redirect or show empty.
                // For now, loading 'all books' but without user data they will look unread.
                // Or we can just return empty to force login.
                // Let's load them to avoid flashing empty screen if brief race condition, but they will be 'clean'
                // Actually, getBooksForUser with invalid ID behaves safely.
                // Let's rely on protected routes to handle "no user"
                // But if we are here, let's try to load clean books?
                // No, just empty list is safer.
                books = [];
            }

            const tags = await getAllTags();
            await get().loadXRayKeywords();
            set({ books, tags, isLoading: false, isFullyLoaded: true });
        } catch (e) {
            console.error(e);
            set({ isLoading: false });
        }
    },
    loadRecentBooks: async () => {
        set({ isLoading: true });
        try {
            // Optimized loading: Fetch only 20 recent books + Reading books
            const recentBooks = await getRecentBooks(20);

            const currentUser = useAppStore.getState().currentUser;
            let booksWithUser = recentBooks;
            let readingBooks: Book[] = [];

            if (currentUser) {
                console.log(`[loadRecentBooks] Current User: ${currentUser.id} (${currentUser.username})`);

                // 1. Get Reading Books specifically (for Continue Reading section)
                readingBooks = await getReadingBooksForUser(currentUser.id);
                console.log(`[loadRecentBooks] Found ${readingBooks.length} reading books for user.`);

                // 2. Hydrate recent books with user data
                const allUserData = await db.userBookData.where('userId').equals(currentUser.id).toArray();
                console.log(`[loadRecentBooks] Found ${allUserData.length} UserBookData entries.`);

                // DEBUG: Check for duplicates specifically for the problematic book
                // 'Madre patria' ID from logs is likely '4283-2069b1a038115533'
                const targetBookId = '4283-2069b1a038115533';
                const madreEntries = allUserData.filter(d => d.bookId === targetBookId || d.bookId.includes('4283'));

                if (madreEntries.length > 0) {
                    console.log(`[loadRecentBooks] Found ${madreEntries.length} entries for Madre patria/problem book:`);
                    madreEntries.forEach(e => {
                        console.log(`   - ID: ${e.id}, PID: ${e.userId}+${e.bookId}, Progress: ${e.progress}%, Status: ${e.status}, Updated: ${e.updatedAt}`);

                        if (e.userId !== currentUser.id) {
                            console.warn(`[loadRecentBooks] MISMATCH DETECTED: Data userId (${e.userId}) != Current Session userId (${currentUser.id}). Using data anyway.`);
                        }
                    });
                }

                const userDataMap = new Map();
                allUserData.forEach(d => {
                    // Check for ID mismatch again for general case
                    if (d.userId !== currentUser.id && d.bookId === targetBookId) {
                        console.warn(`[loadRecentBooks] Processing mismatch for target book ${d.bookId}`);
                    }
                    userDataMap.set(d.bookId, d);
                });

                booksWithUser = recentBooks.map(book => {
                    const data = userDataMap.get(book.id);
                    if (data) {
                        // Debug specific book if needed
                        if (book.title.includes('Madre patria')) {
                            console.log(`[loadRecentBooks] Hydrating 'Madre patria' with progress: ${data.progress}%, status: ${data.status} (User ID in data: ${data.userId})`);
                        }
                        return {
                            ...book,
                            progress: data.progress,
                            status: data.status,
                            lastReadAt: data.lastReadAt,
                            currentPosition: data.currentPosition,
                            currentPage: data.currentPage,
                            isFavorite: data.isFavorite,
                            metadata: {
                                ...book.metadata,
                                userRating: data.userRating,
                                manualCategories: data.manualCategories
                            }
                        };
                    } else {
                        if (book.title.includes('Madre patria')) {
                            console.log(`[loadRecentBooks] 'Madre patria' found in recentBooks but NO UserBookData found for user ${currentUser.id}`);
                        }
                    }
                    return book;
                });
            } else {
                console.log('[loadRecentBooks] No current user.');
            }

            // Merge Lists: recentBooks + readingBooks (deduplicated)
            const combinedMap = new Map<string, Book>();
            // Add booksWithUser FIRST, then readingBooks. 
            // readingBooks comes from 'getReadingBooksForUser' which logic uses `where('userId')...`
            // So readingBooks IS the user data.
            // booksWithUser IS ALSO the user data (hydrated).
            // Logic seems redundant but safe IF hydration works.
            // Let's swap order to prioritize readingBooks just in case? 
            // No, if hydration worked they should be identical.

            [...booksWithUser, ...readingBooks].forEach(b => combinedMap.set(b.id, b));
            const finalBooks = Array.from(combinedMap.values())
                .sort((a, b) => (new Date(b.lastReadAt || b.updatedAt || 0).getTime() - new Date(a.lastReadAt || a.updatedAt || 0).getTime()))
                .slice(0, 40); // Increased limit slightly to accommodate both

            const tags = await getAllTags();
            set({ books: finalBooks, tags, isLoading: false, isFullyLoaded: false }); // Note: isFullyLoaded = false
        } catch (e) {
            console.error(e);
            set({ isLoading: false });
        }
    },
    syncMetadata: async () => {
        try {
            console.log('Triggering metadata sync...');
            await syncData();
            // Refresh local state after sync
            await get().loadBooks();
        } catch (e) {
            console.error('Sync error:', e);
        }
    },
    loadXRayKeywords: async () => {
        try {
            const allXRay = await db.xrayData.toArray();
            const keywordsMap: Record<string, string> = {};
            allXRay.forEach(x => {
                const terms = [
                    ...(x.characters || []).map(c => c.name),
                    ...(x.places || []).map(p => p.name),
                    ...(x.terms || []).map(t => t.name)
                ].join(' ');
                keywordsMap[x.bookId] = terms;
            });
            set({ xrayKeywords: keywordsMap });
        } catch (e) {
            console.error('Failed to load X-Ray keywords', e);
        }
    },
    addBook: (book) => set((state) => ({ books: [book, ...state.books] })),
    updateBook: (id, updates) => {
        // We need to determine if updates are for Book (global) or UserBookData (local)
        // This is tricky in store. 
        // The store just updates local state. The actual DB call typically happens in component or action?
        // Wait, 'updateBook' definition in LibraryStore only updates local state 'books' array.
        // The DB update is usually separate call `import {updateBook} from db`.
        // So this is fine for UI optimistic update.
        // We just need to ensure we mix the data correctly.
        set((state) => ({
            books: state.books.map((b) => b.id === id ? { ...b, ...updates } : b)
        }));
    },
    removeBook: (id) => set((state) => ({
        books: state.books.filter((b) => b.id !== id)
    })),
    setSearchQuery: (query: string) => set({ searchQuery: query }),
    setSortBy: (sort) => set({ sortBy: sort }),
    setActiveCategory: (category) => set({ activeCategory: category }),
    setActiveFormat: (format) => set({ activeFormat: format }),
    setActiveTag: (tag) => set({ activeTag: tag }),
    setTags: (tags) => set({ tags }),
    addTag: (tag) => set((state) => ({ tags: [...state.tags, tag].sort((a, b) => a.name.localeCompare(b.name)) })),
    updateTag: (id, updates) => set((state) => ({
        tags: state.tags.map(t => t.id === id ? { ...t, ...updates } : t).sort((a, b) => a.name.localeCompare(b.name))
    })),
    removeTag: (id) => set((state) => ({ tags: state.tags.filter(t => t.id !== id) })),
    setSortOrder: (order) => set({ sortOrder: order }),
    setIsLoading: (loading) => set({ isLoading: loading }),
    setView: (view) => {
        console.log('Store: setView called with', view);
        set({ currentView: view });
    },
    setActiveThematicCategory: (cat) => set({ activeThematicCategory: cat }),
    setActiveUserRating: (rating) => set({ activeUserRating: rating }),

    filteredBooks: () => {
        const { books, searchQuery, sortBy, sortOrder, activeCategory, activeFormat, activeTag } = get();

        let filtered = books;

        // Filter by category
        if (activeCategory !== 'all') {
            filtered = filtered.filter((b) => {
                if (activeCategory === 'favorites') return b.metadata?.userRating === 'favorito' || b.isFavorite; // Support both
                if (activeCategory === 'unread') return !b.status || b.status === 'unread';
                if (activeCategory === 'interesting') return b.status === 'interesting';
                if (activeCategory === 'planToRead') return b.status === 'planToRead';
                if (activeCategory === 'reading') return b.status === 'reading';
                if (activeCategory === 'completed') return b.status === 'completed';
                if (activeCategory === 're_read') return b.status === 're_read';

                if (activeCategory === 'recientes') {
                    // Handled in sort/slice usually
                    return true;
                }
                return true;
            });
        }

        // Filter by format
        if (activeFormat !== 'all') {
            filtered = filtered.filter((b) => b.format === activeFormat);
        }

        // Filter by Tag
        if (activeTag) {
            filtered = filtered.filter((b) => b.metadata?.tags?.includes(activeTag));
        }

        // Filter by Thematic Category
        const { activeThematicCategory, activeUserRating } = get();
        if (activeThematicCategory) {
            filtered = filtered.filter((b) => b.metadata?.categories?.includes(activeThematicCategory));
        }

        // Filter by User Rating
        if (activeUserRating) {
            filtered = filtered.filter((b) => b.metadata?.userRating === activeUserRating);
        }

        // Filter by search with Relevance Scoring
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            
            // Calculate relevance and filter
            const scoredBooks = filtered.map(b => {
                let score = 0;
                const title = b.title.toLowerCase();
                const author = b.author?.toLowerCase() || '';
                
                // Exact matches
                if (title === query) score += 100;
                if (author === query) score += 100;
                
                // Starts with
                if (title.startsWith(query)) score += 80;
                if (author.startsWith(query)) score += 80;
                
                // Contains
                if (title.includes(query)) score += 60;
                if (author.includes(query)) score += 60;
                
                // Categories / Tags / Rating
                if (b.metadata?.categories?.some(c => c.toLowerCase().includes(query))) score += 40;
                if (b.metadata?.userRating?.toLowerCase().includes(query)) score += 40;
                if (b.metadata?.tags?.some(t => t.toLowerCase().includes(query))) score += 30;

                // Word match (for multi-word queries)
                const queryWords = query.split(/\s+/).filter(w => w.length > 2);
                if (queryWords.length > 1) {
                    let wordMatches = 0;
                    queryWords.forEach(word => {
                        if (title.includes(word) || author.includes(word)) wordMatches++;
                    });
                     // Bonus for matching multiple words
                    score += (wordMatches * 10);
                }

                return { book: b, score };
            }).filter(item => item.score > 0);

            // Sort by Score Descending
            scoredBooks.sort((a, b) => b.score - a.score);

            return scoredBooks.map(item => item.book);
        }

        // Standard Sort (Only if no search query active, or if we want to fallback)
        // If search is active, we already returned above.
        
        filtered = [...filtered].sort((a, b) => {
            let comparison = 0;

            switch (sortBy) {
                case 'title':
                    comparison = a.title.localeCompare(b.title);
                    break;
                case 'author':
                    comparison = (a.author || '').localeCompare(b.author || '');
                    break;
                case 'lastRead':
                    const aTime = a.lastReadAt?.getTime() || 0;
                    const bTime = b.lastReadAt?.getTime() || 0;
                    comparison = aTime - bTime;
                    break;
                case 'addedDate':
                    comparison = (a.addedAt?.getTime() || 0) - (b.addedAt?.getTime() || 0);
                    break;
                case 'progress':
                    // Safe access if undefined
                    comparison = (a.progress || 0) - (b.progress || 0);
                    break;
                case 'fileSize':
                    comparison = (a.fileSize || 0) - (b.fileSize || 0);
                    break;
                case 'relevance':
                    // Simple relevance fallback to last read
                    const rTimeA = a.lastReadAt?.getTime() || 0;
                    const rTimeB = b.lastReadAt?.getTime() || 0;
                    comparison = rTimeA - rTimeB;
                    break;
            }

            return sortOrder === 'asc' ? comparison : -comparison;
        });

        // Limit to 12 for 'recientes' ONLY if no search query (already handled above)
        if (activeCategory === 'recientes') {
            return filtered.slice(0, 12);
        }

        return filtered;
    },
}));

// ===================================
// Reader Store
// ===================================

interface ReaderState {
    book: Book | null;
    isLoading: boolean;
    currentCfi: string;
    currentPage: number;
    totalPages: number;
    chapterTitle: string;
    annotations: Annotation[];
    selectedText: string | null;
    selectionCfi: string | null;

    setBook: (book: Book | null) => void;
    setIsLoading: (loading: boolean) => void;
    setCurrentCfi: (cfi: string) => void;
    setCurrentPage: (page: number) => void;
    setTotalPages: (total: number) => void;
    setChapterTitle: (title: string) => void;
    setAnnotations: (annotations: Annotation[]) => void;
    addAnnotation: (annotation: Annotation) => void;
    removeAnnotation: (id: string) => void;
    setSelection: (text: string | null, cfi: string | null) => void;
    clearSelection: () => void;
    loadAnnotations: (bookId: string) => Promise<void>;
}

export const useReaderStore = create<ReaderState>((set) => ({
    book: null,
    isLoading: true,
    currentCfi: '',
    currentPage: 1,
    totalPages: 1,
    chapterTitle: '',
    annotations: [],
    selectedText: null,
    selectionCfi: null,

    setBook: (book) => set({ book }),
    setIsLoading: (loading) => set({ isLoading: loading }),
    setCurrentCfi: (cfi) => set({ currentCfi: cfi }),
    setCurrentPage: (page) => set({ currentPage: page }),
    setTotalPages: (total) => set({ totalPages: total }),
    setChapterTitle: (title) => set({ chapterTitle: title }),
    setAnnotations: (annotations) => set({ annotations }),
    addAnnotation: (annotation) => set((state) => ({
        annotations: [...state.annotations, annotation]
    })),
    removeAnnotation: (id) => set((state) => ({
        annotations: state.annotations.filter((a) => a.id !== id)
    })),
    setSelection: (text, cfi) => set({ selectedText: text, selectionCfi: cfi }),
    clearSelection: () => set({ selectedText: null, selectionCfi: null }),
    loadAnnotations: async (bookId) => {
        const currentUser = useAppStore.getState().currentUser;
        if (currentUser) {
            const annotations = await getAnnotationsForUserBook(currentUser.id, bookId);
            set({ annotations });
        }
    }
}));


// ===================================
// AI Store
// ===================================

interface AIState {
    isGenerating: boolean;
    currentTask: string | null;
    ragMessages: RagMessage[];
    aiModel?: string;

    setIsGenerating: (generating: boolean) => void;
    setCurrentTask: (task: string | null) => void;
    addRagMessage: (message: RagMessage) => void;
    clearRagMessages: () => void;
}

export interface RagMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    sources?: RagSource[];
    timestamp: Date;
    latency?: number; // Time in milliseconds
}

export interface RagSource {
    bookId: string;
    bookTitle: string;
    chapterTitle: string;
    excerpt: string;
    cfi?: string;
}

export const useAIStore = create<AIState>((set) => ({
    isGenerating: false,
    currentTask: null,
    ragMessages: [],

    setIsGenerating: (generating) => set({ isGenerating: generating }),
    setCurrentTask: (task) => set({ currentTask: task }),
    addRagMessage: (message) => set((state) => ({
        ragMessages: [...state.ragMessages, message]
    })),
    clearRagMessages: () => set({ ragMessages: [] }),
}));
