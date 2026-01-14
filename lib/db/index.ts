import Dexie, { Table } from 'dexie';

// ===================================
// Type Definitions
// ===================================

export interface Book {
  id: string;
  title: string;
  author: string;
  cover?: string; // Base64 or blob URL
  format: 'epub' | 'pdf';
  fileName: string;
  filePath?: string; // Relative path on server (e.g. Author/Book/file.epub)
  fileBlob: Blob;
  fileSize: number;
  addedAt: Date;
  lastReadAt?: Date;
  progress: number; // 0-100
  currentPosition: string; // CFI for EPUB, page number for PDF
  totalPages?: number;
  currentPage?: number;
  metadata: BookMetadata;
  status: 'unread' | 'interesting' | 'planToRead' | 'reading' | 'completed' | 're_read';
  isOnServer?: boolean;
  isFavorite?: boolean;
}





export interface BookMetadata {
  publisher?: string;
  language?: string;
  description?: string;
  isbn?: string;
  publishedDate?: string;
  subjects?: string[];
  series?: string;
  seriesIndex?: number;
  tags?: string[];
}

export interface Annotation {
  id: string;
  bookId: string;
  cfi: string; // Location in book
  text: string; // Selected/highlighted text
  note?: string; // User's note
  color: HighlightColor;
  chapterTitle?: string;
  chapterIndex?: number;
  pageNumber?: number;
  createdAt: Date;
  updatedAt: Date;
}

export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink' | 'orange';

export interface ReadingSession {
  id: string;
  bookId: string;
  startTime: Date;
  endTime: Date;
  pagesRead: number;
  startPosition: string;
  endPosition: string;
}

export interface VectorChunk {
  id: string;
  bookId: string;
  chapterIndex: number;
  chapterTitle?: string;
  text: string;
  embedding: number[];
  startCfi?: string;
  endCfi?: string;
}

export interface XRayData {
  id: string;
  bookId: string;
  characters: XRayEntity[];
  places: XRayEntity[];
  terms: XRayEntity[];
  language?: string;
  summary?: string;
  plot?: string;
  keyPoints?: string[];
  generatedAt: Date;
}

export interface XRayEntity {
  name: string;
  description: string;
  mentions: XRayMention[];
  importance: 'main' | 'secondary' | 'minor';
}

export interface XRayMention {
  cfi: string;
  chapterTitle: string;
  excerpt: string;
}

export interface BookSummary {
  id: string;
  bookId: string;
  type: 'chapter' | 'executive';
  chapterIndex?: number;
  chapterTitle?: string;
  summary: string;
  keyIdeas?: string[];
  generatedAt: Date;
}

export interface AppSettings {
  id: string;
  libraryPath?: string;
  libraryHandle?: FileSystemDirectoryHandle;
  theme: 'light' | 'dark' | 'system';
  readerSettings: ReaderSettings;
  readingGoal: number; // Pages per day
  onboardingComplete: boolean;
}

export interface ReaderSettings {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  marginHorizontal: number;
  marginVertical: number;
  textAlign: 'left' | 'justify';
  theme: 'light' | 'sepia' | 'dark';
  scrollMode: boolean;
  customCSS?: string;
}

// ===================================
// Default Values
// ===================================

export const defaultReaderSettings: ReaderSettings = {
  fontFamily: 'Georgia, serif',
  fontSize: 18,
  lineHeight: 1.8,
  letterSpacing: 0,
  marginHorizontal: 40,
  marginVertical: 20,
  textAlign: 'justify',
  theme: 'light',
  scrollMode: true,
};

export const defaultAppSettings: Omit<AppSettings, 'id'> = {
  theme: 'system',
  readerSettings: defaultReaderSettings,
  readingGoal: 30,
  onboardingComplete: false,
};

// ===================================
// Database Class
// ===================================

export class LectroDB extends Dexie {
  books!: Table<Book, string>;
  annotations!: Table<Annotation, string>;
  readingSessions!: Table<ReadingSession, string>;
  vectorChunks!: Table<VectorChunk, string>;
  xrayData!: Table<XRayData, string>;
  summaries!: Table<BookSummary, string>;
  settings!: Table<AppSettings, string>;

  constructor() {
    super('LectroDB');

    this.version(1).stores({
      books: 'id, title, author, format, addedAt, lastReadAt, progress, status',
      annotations: 'id, bookId, createdAt, color, chapterIndex',
      readingSessions: 'id, bookId, startTime, endTime',
      vectorChunks: 'id, bookId, chapterIndex',
      xrayData: 'id, bookId',
      summaries: 'id, bookId, type, chapterIndex',
      settings: 'id',
    });

    this.version(2).stores({
      books: 'id, title, author, format, addedAt, lastReadAt, progress, status, fileName',
    });

    this.version(3).stores({
      books: 'id, title, author, format, addedAt, lastReadAt, progress, status, fileName, isOnServer',
    });

    this.version(4).stores({
      books: 'id, title, author, format, addedAt, lastReadAt, progress, status, fileName, isOnServer, isFavorite',
    });

    this.version(5).stores({
      books: 'id, title, author, format, addedAt, lastReadAt, progress, status, fileName, filePath, isOnServer, isFavorite',
    });
  }
}

// ===================================
// Database Instance
// ===================================

export const db = new LectroDB();

// ===================================
// Database Operations
// ===================================

// Books
export async function addBook(book: Book): Promise<string> {
  return db.books.add(book);
}

export async function getBook(id: string): Promise<Book | undefined> {
  return db.books.get(id);
}

export async function getAllBooks(): Promise<Book[]> {
  // Use toArray() directly to ensure we get all books, including those without lastReadAt
  // Sorting is handled in the store
  return db.books.toArray();
}

export async function updateBook(id: string, updates: Partial<Book>): Promise<number> {
  return db.books.update(id, updates);
}

export async function deleteBook(id: string): Promise<void> {
  await db.transaction('rw', [db.books, db.annotations, db.vectorChunks, db.xrayData, db.summaries], async () => {
    await db.books.delete(id);
    await db.annotations.where('bookId').equals(id).delete();
    await db.vectorChunks.where('bookId').equals(id).delete();
    await db.xrayData.where('bookId').equals(id).delete();
    await db.summaries.where('bookId').equals(id).delete();
  });
}

// Annotations
export async function addAnnotation(annotation: Annotation): Promise<string> {
  return db.annotations.add(annotation);
}

export async function getAnnotationsForBook(bookId: string): Promise<Annotation[]> {
  return db.annotations.where('bookId').equals(bookId).toArray();
}

export async function updateAnnotation(id: string, updates: Partial<Annotation>): Promise<number> {
  return db.annotations.update(id, { ...updates, updatedAt: new Date() });
}

export async function deleteAnnotation(id: string): Promise<void> {
  await db.annotations.delete(id);
}

export async function getAllAnnotations(): Promise<Annotation[]> {
  return db.annotations.orderBy('createdAt').reverse().toArray();
}

// Reading Sessions
export async function addReadingSession(session: ReadingSession): Promise<string> {
  return db.readingSessions.add(session);
}

export async function getReadingSessionsForBook(bookId: string): Promise<ReadingSession[]> {
  return db.readingSessions.where('bookId').equals(bookId).toArray();
}

export async function getReadingSessionsInRange(start: Date, end: Date): Promise<ReadingSession[]> {
  return db.readingSessions
    .where('startTime')
    .between(start, end)
    .toArray();
}

// Vector Chunks
export async function addVectorChunks(chunks: VectorChunk[]): Promise<void> {
  await db.vectorChunks.bulkAdd(chunks);
}

export async function getVectorChunksForBook(bookId: string): Promise<VectorChunk[]> {
  return db.vectorChunks.where('bookId').equals(bookId).toArray();
}

export async function getAllVectorChunks(): Promise<VectorChunk[]> {
  return db.vectorChunks.toArray();
}

// X-Ray Data
export async function saveXRayData(data: XRayData): Promise<string> {
  const existing = await db.xrayData.where('bookId').equals(data.bookId).first();
  if (existing) {
    // Preserve the existing ID but update all other fields
    await db.xrayData.put({ ...data, id: existing.id });
    return existing.id;
  }
  return db.xrayData.add(data);
}

export async function getXRayData(bookId: string): Promise<XRayData | undefined> {
  return db.xrayData.where('bookId').equals(bookId).first();
}

// Summaries
export async function saveSummary(summary: BookSummary): Promise<string> {
  return db.summaries.add(summary);
}

export async function getSummariesForBook(bookId: string): Promise<BookSummary[]> {
  return db.summaries.where('bookId').equals(bookId).toArray();
}

// Settings
export async function getSettings(): Promise<AppSettings> {
  const settings = await db.settings.get('app');
  if (!settings) {
    const newSettings: AppSettings = { id: 'app', ...defaultAppSettings };
    await db.settings.add(newSettings);
    return newSettings;
  }
  return settings;
}

export async function updateSettings(updates: Partial<AppSettings>): Promise<void> {
  await db.settings.update('app', updates);
}

// Statistics
export async function getReadingStats(days: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const sessions = await db.readingSessions
    .where('startTime')
    .above(startDate)
    .toArray();

  const totalPages = sessions.reduce((sum, s) => sum + s.pagesRead, 0);
  const totalMinutes = sessions.reduce((sum, s) => {
    const duration = (s.endTime.getTime() - s.startTime.getTime()) / 60000;
    return sum + duration;
  }, 0);

  // Group by day
  const dailyStats: Record<string, number> = {};
  sessions.forEach(s => {
    const dateKey = s.startTime.toISOString().split('T')[0];
    dailyStats[dateKey] = (dailyStats[dateKey] || 0) + s.pagesRead;
  });

  return {
    totalPages,
    totalMinutes: Math.round(totalMinutes),
    averagePagesPerDay: Math.round(totalPages / days),
    dailyStats,
    activeDays: Object.keys(dailyStats).length,
    currentStreak: calculateStreak(dailyStats),
  };
}

function calculateStreak(dailyStats: Record<string, number>): number {
  let streak = 0;
  const today = new Date();

  for (let i = 0; i < 365; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateKey = date.toISOString().split('T')[0];

    if (dailyStats[dateKey]) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }

  return streak;
}
