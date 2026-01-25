import Dexie, { Table } from 'dexie';
import { v4 as uuidv4 } from 'uuid';

// ===================================
// Type Definitions
// ===================================

export interface User {
  id: string;
  username: string;
  passwordHash: string; // We'll store a simple hash for now
  createdAt: Date;
  updatedAt?: Date;
  isAdmin?: boolean;
}

export interface UserBookData {
  id?: number;
  userId: string;
  bookId: string;
  progress: number;
  status: 'unread' | 'interesting' | 'planToRead' | 'reading' | 'completed' | 're_read';
  lastReadAt?: Date;
  currentPosition?: string;
  currentPage?: number;
  userRating?: UserBookRating;
  isFavorite?: boolean;
  manualCategories?: BookCategory[];
  updatedAt: Date;
}

// Categorías temáticas de alta jerarquía (automáticas)
export type BookCategory =
  | 'Pensamiento'
  | 'Espiritualidad'
  | 'Sociedad'
  | 'Ciencia'
  | 'Tecnología'
  | 'Narrativa'
  | 'PoesíaDrama'
  | 'ArteCultura'
  | 'Crecimiento'
  | 'Práctica'
  | 'SinClasificar';

// Valoraciones personales del usuario
export type UserBookRating =
  | 'imprescindible'
  | 'favorito'
  | 'referencia'
  | 'releer'
  | 'correcto'
  | 'prescindible';


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
  updatedAt?: Date;
  metadata: BookMetadata;
  isOnServer?: boolean;

  // Deprecated fields (moved to UserBookData), kept optional for type compatibility during migration/types
  lastReadAt?: Date;
  progress?: number;
  currentPosition?: string;
  currentPage?: number;
  status?: 'unread' | 'interesting' | 'planToRead' | 'reading' | 'completed' | 're_read';
  isFavorite?: boolean;
  totalPages?: number;
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
  categories?: BookCategory[];
  manualCategories?: BookCategory[];
  userRating?: UserBookRating;
}

export interface Tag {
  id: string;
  name: string;
  color?: string; // hex color
  createdAt: Date;
  updatedAt?: Date;
}

export interface Annotation {
  id: string;
  bookId: string;
  userId: string; // New field
  cfi: string; // Location in book
  text: string; // Selected/highlighted text
  note?: string; // User's note
  color: HighlightColor;
  chapterTitle?: string;
  chapterIndex?: number;
  pageNumber?: number;
  tags?: string[];
  isFavorite?: boolean;
  isFlashcard?: boolean; // For spaced repetition
  embedding?: number[]; // For semantic search
  deletedAt?: Date; // Soft delete
  createdAt: Date;
  updatedAt: Date;
}

export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink' | 'orange';

export interface ReadingSession {
  id: string;
  bookId: string;
  userId: string; // New field
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
  users!: Table<User, string>;
  userBookData!: Table<UserBookData, number>;
  annotations!: Table<Annotation, string>;
  readingSessions!: Table<ReadingSession, string>;
  vectorChunks!: Table<VectorChunk, string>;
  xrayData!: Table<XRayData, string>;
  summaries!: Table<BookSummary, string>;
  settings!: Table<AppSettings, string>;
  tags!: Table<Tag, string>;

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

    this.version(6).stores({
      tags: 'id, &name, createdAt', // &name makes it unique index
    });

    this.version(7).stores({
      books: 'id, title, author, format, addedAt, lastReadAt, updatedAt, progress, status, fileName, filePath, isOnServer, isFavorite',
      tags: 'id, &name, createdAt, updatedAt',
    });

    this.version(8).stores({
      annotations: 'id, bookId, createdAt, color, chapterIndex, *tags, isFavorite, isFlashcard',
    });

    // Version 9: User Support and Migration
    this.version(9).stores({
      users: 'id, &username',
      userBookData: '++id, [userId+bookId], userId, bookId, lastReadAt, status, isFavorite',
      annotations: 'id, [userId+bookId], userId, bookId, createdAt, color, chapterIndex, *tags, isFavorite, isFlashcard',
      readingSessions: 'id, [userId+bookId], userId, bookId, startTime, endTime',
    }).upgrade(async (trans) => {
      // MIGRATION LOGIC
      // Create Default User 'mcmassia'
      const userId = uuidv4();
      // SHA-256 for 'fidelius' = f10e2d3674686417772274431718873730076046e7e4070a2417757917849814
      const passwordHash = 'f10e2d3674686417772274431718873730076046e7e4070a2417757917849814';

      await trans.table('users').add({
        id: userId,
        username: 'mcmassia',
        passwordHash,
        createdAt: new Date(),
        isAdmin: true
      });

      // Migrate Book Progress
      const books = await trans.table('books').toArray();
      if (books.length > 0) {
        const userBookDataItems = books.map(book => ({
          userId,
          bookId: book.id,
          progress: book.progress || 0,
          status: book.status || 'unread',
          lastReadAt: book.lastReadAt,
          currentPosition: book.currentPosition,
          currentPage: book.currentPage,
          userRating: book.metadata?.userRating,
          isFavorite: book.isFavorite,
          manualCategories: book.metadata?.manualCategories,
          updatedAt: new Date()
        }));
        await trans.table('userBookData').bulkAdd(userBookDataItems);
      }

      // Migrate Annotations
      const annotations = await trans.table('annotations').toArray();
      if (annotations.length > 0) {
        const updatedAnnotations = annotations.map(a => ({ ...a, userId }));
        await trans.table('annotations').bulkPut(updatedAnnotations);
      }

      // Migrate Reading Sessions
      const sessions = await trans.table('readingSessions').toArray();
      if (sessions.length > 0) {
        const updatedSessions = sessions.map(s => ({ ...s, userId }));
        await trans.table('readingSessions').bulkPut(updatedSessions);
      }
    });
  }
}

// ===================================
// Database Instance
// ===================================

export const db = new LectroDB();

// Seed default user
import { hashPassword } from '../auth';
export async function ensureDefaultUser() {
  const existing = await db.users.where('username').equals('mcmassia').first();
  if (!existing) {
    console.log('Seeding default user: mcmassia');
    const passwordHash = await hashPassword('fidelius');
    await db.users.add({
      id: uuidv4(),
      username: 'mcmassia',
      passwordHash,
      createdAt: new Date(),
      isAdmin: true
    });
  }
}

// ===================================
// Database Operations
// ===================================

// Users
export async function getUsers(): Promise<User[]> {
  return db.users.toArray();
}

export async function getUser(username: string): Promise<User | undefined> {
  return db.users.where('username').equals(username).first();
}

export async function createUser(user: User): Promise<string> {
  return db.users.add(user);
}

export async function updateUser(id: string, updates: Partial<User>): Promise<number> {
  return db.users.update(id, { ...updates, updatedAt: new Date() });
}


// Books
export async function addBook(book: Book): Promise<string> {
  if (!book.updatedAt) {
    book.updatedAt = new Date();
  }
  // Remove user-specific fields from book object before saving to 'books' table to keep it clean
  // But strictly Dexie stores what we give it. 
  // We'll keep legacy fields for now to avoid breaking other parts of app that might read them directly before we refactor all.
  // But ideally we should strip them.
  return db.books.add(book);
}

export async function getBook(id: string): Promise<Book | undefined> {
  return db.books.get(id);
}

export async function getAllBooks(): Promise<Book[]> {
  return db.books.toArray();
}

export async function getBooksForUser(userId: string): Promise<Book[]> {
  const books = await db.books.toArray();
  const userData = await db.userBookData.where('userId').equals(userId).toArray();
  const userDataMap = new Map(userData.map(d => [d.bookId, d]));

  return books.map(book => {
    const data = userDataMap.get(book.id);
    if (data) {
      // Merge user data over book data
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
    }
    return {
      ...book,
      status: 'unread',
      progress: 0,
      isFavorite: false,
      lastReadAt: undefined
    };
  });
}

export async function updateUserBookData(userId: string, bookId: string, updates: Partial<UserBookData>): Promise<number> {
  const existing = await db.userBookData.where('[userId+bookId]').equals([userId, bookId]).first();

  if (existing) {
    return db.userBookData.update(existing.id!, { ...updates, updatedAt: new Date() });
  } else {
    // Create new
    const newData: UserBookData = {
      userId,
      bookId,
      progress: 0,
      status: 'unread', // Default
      updatedAt: new Date(),
      ...updates as any // dangerous cast but we trust inputs mostly
    };
    // Ensure defaults if partial doesn't cover
    if (!newData.progress) newData.progress = 0;
    if (!newData.status) newData.status = 'unread';

    await db.userBookData.add(newData);
    return 1;
  }
}


export async function getRecentBooks(limit: number = 12): Promise<Book[]> {
  const books = await db.books.orderBy('updatedAt').reverse().limit(limit).toArray();
  return books;
}

export async function updateBook(id: string, updates: Partial<Book>): Promise<number> {
  return db.books.update(id, { ...updates, updatedAt: new Date() });
}

export async function deleteBook(id: string): Promise<void> {
  await db.transaction('rw', [db.books, db.annotations, db.vectorChunks, db.xrayData, db.summaries, db.userBookData], async () => {
    await db.books.delete(id);
    await db.annotations.where('bookId').equals(id).delete();
    await db.vectorChunks.where('bookId').equals(id).delete();
    await db.xrayData.where('bookId').equals(id).delete();
    await db.summaries.where('bookId').equals(id).delete();
    // Delete user data too
    // We can't delete by bookId easily unless we index bookId or iterate.
    // We indexed bookId in version 9: userBookData: '++id, [userId+bookId], userId, bookId...
    await db.userBookData.where('bookId').equals(id).delete();
  });
}

// Annotations
// Updated to require userId
export async function addAnnotation(annotation: Annotation): Promise<string> {
  return db.annotations.add(annotation);
}

// Updated to filter by userId
export async function getAnnotationsForUserBook(userId: string, bookId: string): Promise<Annotation[]> {
  // We can use the compound index or just filter.
  // Index: [userId+bookId]
  const all = await db.annotations.where('[userId+bookId]').equals([userId, bookId]).toArray();
  return all.filter(a => !a.deletedAt);
}

export async function getAnnotationsForBook(bookId: string): Promise<Annotation[]> {
  // Legacy/Admin view? Or if we want all annotations for a book regardless of user?
  // Probably shouldn't happen in normal usage.
  // Warning: This returns all annotations.
  const all = await db.annotations.where('bookId').equals(bookId).toArray();
  return all.filter(a => !a.deletedAt);
}

export async function updateAnnotation(id: string, updates: Partial<Annotation>): Promise<number> {
  return db.annotations.update(id, { ...updates, updatedAt: new Date() });
}

export async function deleteAnnotation(id: string): Promise<void> {
  await db.annotations.update(id, {
    deletedAt: new Date(),
    updatedAt: new Date()
  });
}

export async function hardDeleteAnnotation(id: string): Promise<void> {
  await db.annotations.delete(id);
}

export async function getAllAnnotations(): Promise<Annotation[]> {
  const all = await db.annotations.orderBy('createdAt').reverse().toArray();
  return all.filter(a => !a.deletedAt);
}
export async function getAllAnnotationsIncludingDeleted(): Promise<Annotation[]> {
  return db.annotations.orderBy('createdAt').reverse().toArray();
}

// Reading Sessions
export async function addReadingSession(session: ReadingSession): Promise<string> {
  return db.readingSessions.add(session);
}

export async function getReadingSessionsForUserBook(userId: string, bookId: string): Promise<ReadingSession[]> {
  return db.readingSessions.where('[userId+bookId]').equals([userId, bookId]).toArray();
}

export async function getReadingSessionsForBook(bookId: string): Promise<ReadingSession[]> {
  return db.readingSessions.where('bookId').equals(bookId).toArray();
}

// Stats need to be user specific now
export async function getReadingStatsForUser(userId: string, days: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // We don't have a simple index for [userId+startTime].
  // We have userId.
  const sessions = await db.readingSessions
    .where('userId')
    .equals(userId)
    .filter(s => s.startTime > startDate)
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

// Internal
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


// Tags
export async function getAllTags(): Promise<Tag[]> {
  return db.tags.orderBy('name').toArray();
}

export async function addTag(name: string, color?: string): Promise<string> {
  const tag: Tag = {
    id: uuidv4(),
    name,
    color,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  return db.tags.add(tag);
}

export async function updateTag(id: string, updates: Partial<Tag>): Promise<number> {
  return db.tags.update(id, { ...updates, updatedAt: new Date() });
}

export async function deleteTag(id: string): Promise<void> {
  await db.tags.delete(id);
}

export async function syncTagsFromBooks(books?: Book[]): Promise<void> {
  const targetBooks = books || await getAllBooks();
  const existingTags = await getAllTags();
  const existingTagNames = new Set(existingTags.map(t => t.name));

  const tagsToAdd = new Set<string>();

  targetBooks.forEach(book => {
    book.metadata?.tags?.forEach(tagName => {
      if (!existingTagNames.has(tagName)) {
        tagsToAdd.add(tagName);
      }
    });
  });

  if (tagsToAdd.size === 0) return;

  const newTags: Tag[] = Array.from(tagsToAdd).map(name => ({
    id: uuidv4(),
    name,
    createdAt: new Date(),
    updatedAt: new Date()
  }));

  await db.tags.bulkAdd(newTags);
}
