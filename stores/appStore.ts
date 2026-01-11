import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
    Book,
    Annotation,
    AppSettings,
    ReaderSettings,
    defaultAppSettings,
    defaultReaderSettings
} from '@/lib/db';

// ===================================
// App Store Types
// ===================================

interface AppState {
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

    // Reader sidebar
    readerSidebarOpen: boolean;
    readerSidebarTab: 'toc' | 'annotations' | 'xray' | 'settings';
    setReaderSidebarOpen: (open: boolean) => void;
    setReaderSidebarTab: (tab: 'toc' | 'annotations' | 'xray' | 'settings') => void;
}

// ===================================
// App Store
// ===================================

export const useAppStore = create<AppState>()(
    persist(
        (set, get) => ({
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

            // Reader sidebar
            readerSidebarOpen: true,
            readerSidebarTab: 'toc',
            setReaderSidebarOpen: (open) => set({ readerSidebarOpen: open }),
            setReaderSidebarTab: (tab) => set({ readerSidebarTab: tab }),
        }),
        {
            name: 'lectro-storage',
            partialize: (state) => ({
                theme: state.theme,
                libraryPath: state.libraryPath,
                onboardingComplete: state.onboardingComplete,
                readerSettings: state.readerSettings,
                dailyReadingGoal: state.dailyReadingGoal,
                sidebarCollapsed: state.sidebarCollapsed,
                readerSidebarOpen: state.readerSidebarOpen,
                readerSidebarTab: state.readerSidebarTab,
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
    searchQuery: string;
    sortBy: 'title' | 'author' | 'lastRead' | 'addedDate' | 'progress' | 'fileSize' | 'relevance';
    activeCategory: 'all' | 'favorites' | 'planToRead' | 'completed';
    sortOrder: 'asc' | 'desc';

    setBooks: (books: Book[]) => void;
    addBook: (book: Book) => void;
    updateBook: (id: string, updates: Partial<Book>) => void;
    removeBook: (id: string) => void;
    setSearchQuery: (query: string) => void;
    setSortBy: (sort: 'title' | 'author' | 'lastRead' | 'addedDate' | 'progress' | 'fileSize' | 'relevance') => void;
    setActiveCategory: (category: 'all' | 'favorites' | 'planToRead' | 'completed') => void;
    setSortOrder: (order: 'asc' | 'desc') => void;
    setIsLoading: (loading: boolean) => void;

    // Computed
    filteredBooks: () => Book[];
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
    books: [],
    isLoading: true,
    searchQuery: '',
    sortBy: 'relevance',
    activeCategory: 'all',
    sortOrder: 'desc',

    setBooks: (books) => set({ books, isLoading: false }),
    addBook: (book) => set((state) => ({ books: [book, ...state.books] })),
    updateBook: (id, updates) => set((state) => ({
        books: state.books.map((b) => b.id === id ? { ...b, ...updates } : b)
    })),
    removeBook: (id) => set((state) => ({
        books: state.books.filter((b) => b.id !== id)
    })),
    setSearchQuery: (query: string) => set({ searchQuery: query }),
    setSortBy: (sort) => set({ sortBy: sort }),
    setActiveCategory: (category) => set({ activeCategory: category }),
    setSortOrder: (order) => set({ sortOrder: order }),
    setIsLoading: (loading) => set({ isLoading: loading }),

    filteredBooks: () => {
        const { books, searchQuery, sortBy, sortOrder, activeCategory } = get();

        let filtered = books;

        // Filter by category
        if (activeCategory !== 'all') {
            filtered = filtered.filter((b) => {
                if (activeCategory === 'favorites') return b.status === 'favorite';
                if (activeCategory === 'planToRead') return b.status === 'planToRead';
                if (activeCategory === 'completed') return b.status === 'completed';
                return true;
            });
        }

        // Filter by search
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter((b) =>
                b.title.toLowerCase().includes(query) ||
                b.author.toLowerCase().includes(query)
            );
        }

        // Sort
        filtered = [...filtered].sort((a, b) => {
            let comparison = 0;

            switch (sortBy) {
                case 'title':
                    comparison = a.title.localeCompare(b.title);
                    break;
                case 'author':
                    comparison = a.author.localeCompare(b.author);
                    break;
                case 'lastRead':
                    const aTime = a.lastReadAt?.getTime() || 0;
                    const bTime = b.lastReadAt?.getTime() || 0;
                    comparison = aTime - bTime;
                    break;
                case 'addedDate':
                    comparison = a.addedAt.getTime() - b.addedAt.getTime();
                    break;
                case 'progress':
                    comparison = a.progress - b.progress;
                    break;
                case 'fileSize':
                    comparison = a.fileSize - b.fileSize;
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
}));

// ===================================
// AI Store
// ===================================

interface AIState {
    isGenerating: boolean;
    currentTask: string | null;
    ragMessages: RagMessage[];

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
