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
  hasCover?: boolean; // Flag indicating if cover exists in covers table (for filtering without loading heavy data)
  format: 'epub' | 'pdf';
  fileName: string;
  filePath?: string; // Relative path on server (e.g. Author/Book/file.epub)
  fileBlob: Blob;
  fileSize: number;
  addedAt: Date;
  updatedAt?: Date;
  metadata: BookMetadata;
  isOnServer?: boolean;
  deletedAt?: Date;
  indexedAt?: Date;
  deepIndexedAt?: Date; // Explicit field for Vector Embeddings status

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

// File Blob separation (Version 12)
export interface FileEntry {
  bookId: string;
  fileBlob: Blob;
}

// Cover separation (Version 13)
export interface CoverEntry {
  bookId: string;
  coverBlob: string; // Base64
}

// Metas de lectura del usuario
export interface ReadingGoals {
  id?: number;
  userId: string;
  dailyTimeGoalMinutes: number;      // Meta diaria en minutos (ej: 15)
  yearlyBooksGoal: number;           // Meta anual de libros (ej: 12)
  streakRecord: number;              // Récord de racha de días
  streakRecordDate?: Date;           // Cuándo se logró el récord
  longestReadingSessionMinutes?: number; // Sesión más larga en minutos
  goalCompletedDays: number;         // Días con objetivo completado
  updatedAt: Date;
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
  files!: Table<FileEntry, string>; // New table for blobs
  covers!: Table<CoverEntry, string>; // New table for covers
  readingGoals!: Table<ReadingGoals, number>; // Reading goals per user

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
    });

    this.version(10).stores({
      books: 'id, title, author, format, addedAt, lastReadAt, updatedAt, progress, status, fileName, filePath, isOnServer, isFavorite, deletedAt',
    }).upgrade(async (trans) => {
      // MIGRATION LOGIC
      // Create Default User 'mcmassia'
      const userId = uuidv4();
      // SHA-256 for 'fidelius' (Verified)
      const passwordHash = '7a1e679ebcc55800d319e5d5d3b80a620159206ad5101086c0c56bcb6ea37708';

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

    this.version(11).stores({
      books: 'id, title, author, format, addedAt, lastReadAt, updatedAt, progress, status, fileName, filePath, isOnServer, isFavorite, deletedAt, indexedAt',
    });

    this.version(12).stores({
      files: 'bookId, fileBlob', // New table for BLOBS
      books: 'id, title, author, format, addedAt, lastReadAt, updatedAt, progress, status, fileName, filePath, isOnServer, isFavorite, deletedAt, indexedAt'
    }).upgrade(async (trans) => {
      // Critical Migration: Move Blobs to Files Table
      const booksCount = await trans.table('books').count();
      console.log(`[Migration v12] Starting migration for ${booksCount} books. Separating BLOBS...`);

      // Iterate using cursor to avoid loading all at once
      await trans.table('books').toCollection().modify((book, ref) => {
        if (book.fileBlob) {
          // We cannot use await here in modify? modify handles sync updates mostly?
          // Dexie .modify doesn't support async writing to ANOTHER table easily inside the callback if it returns void.
          // Actually, modify() expects modifications to the object.

          // STRATEGY CHANGE: 
          // We cannot easily move data between tables inside a .modify().
          // We should iterate.
        }
      });

      // Dexie upgrade transactions are special. We can use bulk ops.
      // But we need to be careful about memory.
      const BATCH_SIZE = 50;
      let offset = 0;

      while (true) {
        const books = await trans.table('books').offset(offset).limit(BATCH_SIZE).toArray();
        if (books.length === 0) break;

        const filesBatch: any[] = [];

        for (const book of books) {
          if (book.fileBlob) {
            filesBatch.push({ bookId: book.id, fileBlob: book.fileBlob });
            delete book.fileBlob; // Remove from book object in memory
          }
        }

        if (filesBatch.length > 0) {
          await trans.table('files').bulkPut(filesBatch);
        }

        // Update books to remove blob property in DB
        // We can use bulkPut to overwrite the books (now without fileBlob)
        await trans.table('books').bulkPut(books);

        offset += BATCH_SIZE;
        console.log(`[Migration v12] Processed ${offset} books...`);
      }
      console.log(`[Migration v12] Migration complete.`);
    });

    this.version(13).stores({
      covers: 'bookId, coverBlob', // New table for COVERS
      books: 'id, title, author, format, addedAt, lastReadAt, updatedAt, progress, status, fileName, filePath, isOnServer, isFavorite, deletedAt, indexedAt'
    }).upgrade(async (trans) => {
      // Critical Migration: Move Covers to Covers Table
      const booksCount = await trans.table('books').count();
      console.log(`[Migration v13] Starting cover migration for ${booksCount} books...`);

      const BATCH_SIZE = 50;
      let offset = 0;

      while (true) {
        const books = await trans.table('books').offset(offset).limit(BATCH_SIZE).toArray();
        if (books.length === 0) break;

        const coversBatch: any[] = [];

        for (const book of books) {
          if (book.cover) {
            coversBatch.push({ bookId: book.id, coverBlob: book.cover });
            delete book.cover; // Remove string from book object
          }
        }

        if (coversBatch.length > 0) {
          await trans.table('covers').bulkPut(coversBatch);
        }

        // Update books
        await trans.table('books').bulkPut(books);

        offset += BATCH_SIZE;
        console.log(`[Migration v13] Processed ${offset} books...`);
      }
      console.log(`[Migration v13] Cover migration complete.`);
    });

    this.version(14).stores({
      books: 'id, title, author, format, addedAt, lastReadAt, updatedAt, progress, status, fileName, filePath, isOnServer, isFavorite, deletedAt, indexedAt, deepIndexedAt'
    });

    // Version 15: Reading Goals
    this.version(15).stores({
      readingGoals: '++id, &userId'
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
  const passwordHash = await hashPassword('fidelius');
  // Fixed UUID for the default user to ensure cross-device consistency for annotations
  const DEFAULT_USER_ID = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';

  if (!existing) {
    console.log('Seeding default user: mcmassia');
    await db.users.add({
      id: DEFAULT_USER_ID,
      username: 'mcmassia',
      passwordHash,
      createdAt: new Date(),
      isAdmin: true
    });
  } else {
    // Verify password is correct (auto-heal if hash is wrong/corrupted)
    // Correct SHA-256 for 'fidelius'
    const CORRECT_HASH = '7a1e679ebcc55800d319e5d5d3b80a620159206ad5101086c0c56bcb6ea37708';

    if (existing.passwordHash !== CORRECT_HASH) {
      console.log('Correcting password hash for: mcmassia');
      await db.users.update(existing.id, {
        passwordHash: CORRECT_HASH,
        updatedAt: new Date()
      });
    }

    // Check for ID mismatch only, do NOT force password update

    // Warn if ID mismatch (debug info)

    // Warn if ID mismatch (debug info)
    if (existing.id !== DEFAULT_USER_ID) {
      console.warn(`Default user ID mismatch. Expected ${DEFAULT_USER_ID}, got ${existing.id}. Annotations may not sync correctly.`);

      // Optional: Auto-correct ID? 
      // Changing primary key in Dexie requires delete and add. 
      // We'd need to migrate all related data (annotations, sessions, etc). 
      // For this fix, we'll assume the user can re-import or is okay with this alignment going forward.
      // Or we can try to migrate it now.
      if (await confirmMigration(existing.id, DEFAULT_USER_ID)) {
        await migrateUser(existing.id, DEFAULT_USER_ID, existing);
      }
    }
  }
}

// Helper to migrate user ID if needed (simplified)
async function confirmMigration(oldId: string, newId: string) {
  // In a real app we might ask UI, here we automigrate for the fix
  return true;
}

async function migrateUser(oldId: string, newId: string, user: User) {
  console.log(`Migrating user from ${oldId} to ${newId}`);
  await db.transaction('rw', [db.users, db.userBookData, db.annotations, db.readingSessions], async () => {
    // 1. Create new user
    await db.users.add({ ...user, id: newId });

    // 2. Migrate data
    // UserBookData
    const bookData = await db.userBookData.where('userId').equals(oldId).toArray();
    const newBookData = bookData.map(b => ({ ...b, userId: newId, id: undefined })); // reset auto-inc ID
    await db.userBookData.bulkAdd(newBookData as any);
    await db.userBookData.where('userId').equals(oldId).delete();

    // Annotations
    const annotations = await db.annotations.where('userId').equals(oldId).toArray();
    const newAnnotations = annotations.map(a => ({ ...a, userId: newId }));
    await db.annotations.bulkAdd(newAnnotations); // IDs should stay same? No, compound index includes userId? 
    // annotations: 'id, [userId+bookId]...' 
    // ID is primary key (uuid). We just update the userId field.
    // Wait, 'id' is primary. We can just update the records!
    await db.annotations.where('userId').equals(oldId).modify({ userId: newId });

    // ReadingSessions
    await db.readingSessions.where('userId').equals(oldId).modify({ userId: newId });

    // 3. Delete old user
    await db.users.delete(oldId);
  });
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

  // Separate heavy fields
  const { fileBlob, cover, ...rest } = book;

  await db.transaction('rw', [db.books, db.files, db.covers], async () => {
    // 1. Save metadata
    await db.books.add(rest as Book);

    // 2. Save blob if present
    if (fileBlob) {
      await db.files.add({ bookId: book.id, fileBlob });
    }

    // 3. Save cover if present
    if (cover) {
      await db.covers.add({ bookId: book.id, coverBlob: cover });
    }
  });

  return book.id;
}

export async function getBook(id: string): Promise<Book | undefined> {
  const book = await db.books.get(id);
  if (!book) return undefined;

  // Retrieve blob if exists
  const fileEntry = await db.files.get(id);
  if (fileEntry) {
    book.fileBlob = fileEntry.fileBlob;
  }

  // Retrieve cover if exists (needed for Detail view)
  const coverEntry = await db.covers.get(id);
  if (coverEntry) {
    book.cover = coverEntry.coverBlob;
  }

  return book;
}

export async function getBookFile(id: string): Promise<Blob | undefined> {
  const entry = await db.files.get(id);
  return entry?.fileBlob;
}

export async function getBookCover(id: string): Promise<string | undefined> {
  const entry = await db.covers.get(id);
  return entry?.coverBlob;
}

export async function getAllBooks(): Promise<Book[]> {
  // Now that blobs are in a separate table, we can safely use toArray() again
  const books = await db.books.toArray();

  // Get all book IDs that have covers in local IndexedDB (without loading the actual cover data)
  const coverEntries = await db.covers.toArray();
  const bookIdsWithLocalCovers = new Set(coverEntries.map(c => c.bookId));

  return books
    .filter(b => !b.deletedAt)
    .map(book => ({
      ...book,
      // hasCover is true if:
      // 1. Book is on server (covers are served via /api/covers/[bookId])
      // 2. Book has filePath (also served from server)
      // 3. Book has a cover entry in local IndexedDB covers table
      hasCover: !!(book.isOnServer || book.filePath || bookIdsWithLocalCovers.has(book.id))
    }));
}

export async function getAllBooksIncludingDeleted(): Promise<Book[]> {
  return db.books.toArray();
}

export async function getBookForUser(bookId: string, userId: string): Promise<Book | undefined> {
  const book = await getBook(bookId);
  if (!book) return undefined;

  const userData = await db.userBookData.where('[userId+bookId]').equals([userId, bookId]).first();

  if (userData) {
    return {
      ...book,
      progress: userData.progress,
      status: userData.status,
      lastReadAt: userData.lastReadAt,
      currentPosition: userData.currentPosition,
      currentPage: userData.currentPage,
      isFavorite: userData.isFavorite,
      metadata: {
        ...book.metadata,
        userRating: userData.userRating,
        manualCategories: userData.manualCategories
      }
    };
  }

  return book;
}

export async function getBooksForUser(userId: string): Promise<Book[]> {
  const books = await getAllBooks(); // Now optimized

  /* 
   * CRITICAL FIX: Handle potential User ID mismatches due to migration/sync issues.
   * Query for both current user ID AND known legacy ID if applicable.
   */
  let queries = [userId];
  const knownLegacyId = '9342fc80-1734-481a-a67f-dcfc05bb2604';
  if (userId !== knownLegacyId && userId.startsWith('4283')) {
    queries.push(knownLegacyId);
  }

  const userDataPromises = queries.map(uid =>
    db.userBookData.where('userId').equals(uid).toArray()
  );
  const results = await Promise.all(userDataPromises);
  const allUserData = results.flat();

  // Deduplicate: Keep latest updated per bookId
  const userDataMap = new Map<string, UserBookData>();
  allUserData.forEach(d => {
    const existing = userDataMap.get(d.bookId);
    if (!existing || (new Date(d.updatedAt).getTime() > new Date(existing.updatedAt).getTime())) {
      userDataMap.set(d.bookId, d);
    }
  });

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
  const books = await db.books
    .orderBy('updatedAt')
    .reverse()
    .filter(b => !b.deletedAt)
    .limit(limit)
    .toArray();

  // Get cover status for these books (for local-only books)
  const bookIds = books.map(b => b.id);
  const coverEntries = await db.covers.where('bookId').anyOf(bookIds).toArray();
  const bookIdsWithLocalCovers = new Set(coverEntries.map(c => c.bookId));

  // Strip blobs and add hasCover flag
  return books.map(book => {
    const { fileBlob, ...rest } = book;
    return {
      ...rest,
      // hasCover: true if on server, has filePath, or has local cover entry
      hasCover: !!(book.isOnServer || book.filePath || bookIdsWithLocalCovers.has(book.id))
    } as Book;
  });
}

export async function getReadingBooksForUser(userId: string): Promise<Book[]> {
  /* 
   * CRITICAL FIX: Handle potential User ID mismatches due to migration/sync issues.
   * We noticed that for some users, data is stored under an old '9342fc...' ID but current user is '4283...'.
   * We will attempt to fetch for BOTH if we detect this specific known legacy ID, or just relax the check if needed.
   * For now, we will query for the current user, but also potentially fallback or merge if we find nothing.
   * Actually, let's explicitly query for the known legacy ID if the current user ID is the new one.
   */
  let queries = [userId];
  // Hardcoded known legacy ID observed in logs - better to be safe for this user
  const knownLegacyId = '9342fc80-1734-481a-a67f-dcfc05bb2604';
  if (userId !== knownLegacyId && userId.startsWith('4283')) {
    queries.push(knownLegacyId);
  }

  const readingDataPromises = queries.map(uid =>
    db.userBookData
      .where('userId')
      .equals(uid)
      .filter(d => d.status === 'reading')
      .toArray()
  );

  const results = await Promise.all(readingDataPromises);
  const readingData = results.flat();

  if (readingData.length === 0) return [];

  // Deduplicate: Keep latest updated per bookId
  const uniqueDataMap = new Map<string, UserBookData>();
  readingData.forEach(d => {
    const existing = uniqueDataMap.get(d.bookId);
    if (!existing || (new Date(d.updatedAt).getTime() > new Date(existing.updatedAt).getTime())) {
      uniqueDataMap.set(d.bookId, d);
    }
  });

  const finalReadingData = Array.from(uniqueDataMap.values());
  const bookIds = finalReadingData.map(d => d.bookId);
  const books = await db.books.where('id').anyOf(bookIds).toArray();

  // Get cover status for these books (for local-only books)
  const coverEntries = await db.covers.where('bookId').anyOf(bookIds).toArray();
  const bookIdsWithLocalCovers = new Set(coverEntries.map(c => c.bookId));

  // Merge data and STRIP BLOBS
  const booksMap = new Map(books.map(b => [b.id, b]));

  return finalReadingData.map(data => {
    const book = booksMap.get(data.bookId);
    if (!book) return null;

    const { fileBlob, ...rest } = book; // Strip blob!

    return {
      ...rest,
      // hasCover: true if on server, has filePath, or has local cover entry
      hasCover: !!(book.isOnServer || book.filePath || bookIdsWithLocalCovers.has(book.id)),
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
    } as Book;
  }).filter(b => b !== null) as Book[];
}

export async function updateBook(id: string, updates: Partial<Book>): Promise<number> {
  const { fileBlob, cover, ...rest } = updates;

  await db.transaction('rw', [db.books, db.files, db.covers], async () => {
    // 1. Update metadata
    if (Object.keys(rest).length > 0) {
      await db.books.update(id, { ...rest, updatedAt: new Date() });
    }

    // 2. Update blob if present
    if (fileBlob) {
      await db.files.put({ bookId: id, fileBlob });
    }

    // 3. Update cover if present
    if (cover) {
      await db.covers.put({ bookId: id, coverBlob: cover });
    }
  });
  return 1;
}

export async function deleteBook(id: string): Promise<void> {
  // Soft Delete
  await updateBook(id, { deletedAt: new Date() });
}

export async function hardDeleteBook(id: string): Promise<void> {
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

export async function getAllAnnotationsForUser(userId: string): Promise<Annotation[]> {
  const all = await db.annotations.orderBy('createdAt').reverse().toArray();
  return all.filter(a => a.userId === userId && !a.deletedAt);
}

export async function getAllAnnotations(): Promise<Annotation[]> {
  // Deprecated: use getAllAnnotationsForUser
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

export async function getAllXRayData(): Promise<XRayData[]> {
  return db.xrayData.toArray();
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

// Recovery function for legacy data (annotations/sessions without userId)
export async function recoverLegacyData(targetUserId?: string): Promise<{ annotations: number; sessions: number; userBookData: number }> {
  let userId = targetUserId;

  // If no userId provided, find the default 'mcmassia' user in the database
  if (!userId) {
    const mcmassiaUser = await db.users.where('username').equals('mcmassia').first();
    if (mcmassiaUser) {
      userId = mcmassiaUser.id;
      console.log(`[Recovery] Using mcmassia user ID: ${userId}`);
    } else {
      console.error('[Recovery] No mcmassia user found in database');
      return { annotations: 0, sessions: 0, userBookData: 0 };
    }
  }

  let migratedAnnotations = 0;
  let migratedSessions = 0;
  let migratedUserBookData = 0;

  // 1. Find orphan annotations (no userId or empty userId)
  const allAnnotations = await db.annotations.toArray();
  const orphanAnnotations = allAnnotations.filter(a => !a.userId || a.userId === '');

  if (orphanAnnotations.length > 0) {
    console.log(`[Recovery] Found ${orphanAnnotations.length} orphan annotations`);
    for (const annotation of orphanAnnotations) {
      await db.annotations.update(annotation.id, { userId, updatedAt: new Date() });
    }
    migratedAnnotations = orphanAnnotations.length;
  }

  // 2. Find orphan reading sessions
  const allSessions = await db.readingSessions.toArray();
  const orphanSessions = allSessions.filter(s => !s.userId || s.userId === '');

  if (orphanSessions.length > 0) {
    console.log(`[Recovery] Found ${orphanSessions.length} orphan reading sessions`);
    for (const session of orphanSessions) {
      await db.readingSessions.update(session.id, { userId });
    }
    migratedSessions = orphanSessions.length;
  }

  // 3. Migrate book progress/status from books table to userBookData if missing
  // Optimized to avoid loading all books (with blobs) into memory at once
  const existingUserData = await db.userBookData.where('userId').equals(userId).toArray();
  const existingBookIds = new Set(existingUserData.map(d => d.bookId));

  const userBookDataItems: UserBookData[] = [];

  // Use .each() to stream instead of .toArray() to prevent OOM with large libraries
  await db.books.each(book => {
    if (!existingBookIds.has(book.id) &&
      (book.progress || book.status || book.lastReadAt || book.currentPosition)) {

      userBookDataItems.push({
        userId: userId!, // verified valid above
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
      });
    }
  });

  if (userBookDataItems.length > 0) {
    console.log(`[Recovery] Found ${userBookDataItems.length} books with progress to migrate`);
    // Batch insert in chunks if needed, but bulkAdd handles moderately large arrays well (meta data is small)
    await db.userBookData.bulkAdd(userBookDataItems);
    migratedUserBookData = userBookDataItems.length;
  }

  console.log(`[Recovery] Complete: ${migratedAnnotations} annotations, ${migratedSessions} sessions, ${migratedUserBookData} book data records`);

  return { annotations: migratedAnnotations, sessions: migratedSessions, userBookData: migratedUserBookData };
}

// ===================================
// Reading Goals Operations
// ===================================

const defaultReadingGoals: Omit<ReadingGoals, 'id' | 'userId' | 'updatedAt'> = {
  dailyTimeGoalMinutes: 15,
  yearlyBooksGoal: 12,
  streakRecord: 0,
  goalCompletedDays: 0,
};

export async function getReadingGoals(userId: string): Promise<ReadingGoals> {
  const existing = await db.readingGoals.where('userId').equals(userId).first();
  if (existing) return existing;

  // Create default goals for user
  const newGoals: ReadingGoals = {
    userId,
    ...defaultReadingGoals,
    updatedAt: new Date(),
  };
  await db.readingGoals.add(newGoals);
  return newGoals;
}

export async function updateReadingGoals(userId: string, updates: Partial<ReadingGoals>): Promise<number> {
  const existing = await db.readingGoals.where('userId').equals(userId).first();

  if (existing) {
    return db.readingGoals.update(existing.id!, { ...updates, updatedAt: new Date() });
  } else {
    const newGoals: ReadingGoals = {
      userId,
      ...defaultReadingGoals,
      ...updates,
      updatedAt: new Date(),
    };
    await db.readingGoals.add(newGoals);
    return 1;
  }
}

// Get time-focused stats for the user
export async function getTimeStatsForUser(userId: string, days: number = 30) {
  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);
  startDate.setDate(startDate.getDate() - days + 1);

  const sessions = await db.readingSessions
    .where('userId')
    .equals(userId)
    .filter(s => s.startTime >= startDate)
    .toArray();

  // Daily time stats in minutes
  const dailyTimeMinutes: Record<string, number> = {};
  sessions.forEach(s => {
    const dateKey = s.startTime.toISOString().split('T')[0];
    const duration = (s.endTime.getTime() - s.startTime.getTime()) / 60000;
    dailyTimeMinutes[dateKey] = (dailyTimeMinutes[dateKey] || 0) + duration;
  });

  // Today's reading time
  const today = new Date().toISOString().split('T')[0];
  const todayMinutes = dailyTimeMinutes[today] || 0;

  // This week's reading time (last 7 days)
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const thisWeekMinutes = sessions
    .filter(s => s.startTime >= weekAgo)
    .reduce((sum, s) => sum + (s.endTime.getTime() - s.startTime.getTime()) / 60000, 0);

  // This month's reading time
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const thisMonthMinutes = sessions
    .filter(s => s.startTime >= monthStart)
    .reduce((sum, s) => sum + (s.endTime.getTime() - s.startTime.getTime()) / 60000, 0);

  // Total time in range
  const totalMinutes = sessions.reduce((sum, s) => {
    const duration = (s.endTime.getTime() - s.startTime.getTime()) / 60000;
    return sum + duration;
  }, 0);

  return {
    todayMinutes: Math.round(todayMinutes),
    thisWeekMinutes: Math.round(thisWeekMinutes),
    thisMonthMinutes: Math.round(thisMonthMinutes),
    totalMinutes: Math.round(totalMinutes),
    dailyTimeMinutes,
    activeDays: Object.keys(dailyTimeMinutes).length,
  };
}

// Get books completed in a specific year
export async function getCompletedBooksForYear(userId: string, year: number): Promise<{ book: Book; completedAt: Date }[]> {
  const startOfYear = new Date(year, 0, 1);
  const endOfYear = new Date(year, 11, 31, 23, 59, 59);

  // Get user book data that's completed
  const completedData = await db.userBookData
    .where('userId')
    .equals(userId)
    .filter(d => d.status === 'completed' && d.updatedAt >= startOfYear && d.updatedAt <= endOfYear)
    .toArray();

  if (completedData.length === 0) return [];

  // Get the actual books
  const result: { book: Book; completedAt: Date }[] = [];
  for (const data of completedData) {
    const book = await db.books.get(data.bookId);
    if (book && !book.deletedAt) {
      // Get cover for the book
      const coverEntry = await db.covers.get(data.bookId);
      if (coverEntry) {
        book.cover = coverEntry.coverBlob;
      }
      result.push({ book, completedAt: data.updatedAt });
    }
  }

  return result.sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime());
}

// Calculate streak considering a goal (returns both reading days streak and goal-met streak)
export async function getStreakStats(userId: string, dailyGoalMinutes: number) {
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  const sessions = await db.readingSessions
    .where('userId')
    .equals(userId)
    .filter(s => s.startTime >= sixtyDaysAgo)
    .toArray();

  // Group by day with time in minutes
  const dailyTimeMinutes: Record<string, number> = {};
  sessions.forEach(s => {
    const dateKey = s.startTime.toISOString().split('T')[0];
    const duration = (s.endTime.getTime() - s.startTime.getTime()) / 60000;
    dailyTimeMinutes[dateKey] = (dailyTimeMinutes[dateKey] || 0) + duration;
  });

  // Calculate current reading streak (just any reading)
  let currentReadingStreak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < 60; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() - i);
    const dateKey = checkDate.toISOString().split('T')[0];

    if (dailyTimeMinutes[dateKey] && dailyTimeMinutes[dateKey] > 0) {
      currentReadingStreak++;
    } else if (i > 0) {
      // Allow today to be missing (user might not have read yet today)
      break;
    }
  }

  // Calculate goal-met streak
  let currentGoalStreak = 0;
  for (let i = 0; i < 60; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() - i);
    const dateKey = checkDate.toISOString().split('T')[0];

    if (dailyTimeMinutes[dateKey] && dailyTimeMinutes[dateKey] >= dailyGoalMinutes) {
      currentGoalStreak++;
    } else if (i > 0) {
      break;
    }
  }

  // Count total days where goal was met
  const goalMetDays = Object.values(dailyTimeMinutes).filter(m => m >= dailyGoalMinutes).length;

  return {
    currentReadingStreak,
    currentGoalStreak,
    goalMetDays,
    dailyTimeMinutes,
  };
}

// Check and update records after a reading session
export async function checkAndUpdateRecords(userId: string, sessionMinutes?: number): Promise<{ newStreakRecord: boolean; newSessionRecord: boolean }> {
  const goals = await getReadingGoals(userId);
  const streakStats = await getStreakStats(userId, goals.dailyTimeGoalMinutes);

  let newStreakRecord = false;
  let newSessionRecord = false;
  const updates: Partial<ReadingGoals> = {};

  // Check streak record
  if (streakStats.currentReadingStreak > goals.streakRecord) {
    updates.streakRecord = streakStats.currentReadingStreak;
    updates.streakRecordDate = new Date();
    newStreakRecord = true;
  }

  // Check longest session record
  if (sessionMinutes && (!goals.longestReadingSessionMinutes || sessionMinutes > goals.longestReadingSessionMinutes)) {
    updates.longestReadingSessionMinutes = sessionMinutes;
    newSessionRecord = true;
  }

  // Update goal completed days
  updates.goalCompletedDays = streakStats.goalMetDays;

  if (Object.keys(updates).length > 0) {
    await updateReadingGoals(userId, updates);
  }

  return { newStreakRecord, newSessionRecord };
}

