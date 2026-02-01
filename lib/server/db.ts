
import fs from 'fs';
import path from 'path';
import { getLibraryPath } from './config';

/**
 * Simple Mutex to ensure sequential execution of async tasks.
 * This effectively queues up operations.
 */
class Mutex {
    private mutex = Promise.resolve();

    lock(): Promise<() => void> {
        let begin: (unlock: () => void) => void = () => { };

        this.mutex = this.mutex.then(() => {
            return new Promise<void>(resolve => {
                begin = resolve;
            });
        });

        return new Promise<() => void>(resolve => {
            resolve(begin as unknown as () => void); // Type assertion to bypass strict check for function passing
        });
    }

    async dispatch<T>(fn: (() => T) | (() => PromiseLike<T>)): Promise<T> {
        const unlock = await this.lock();
        try {
            return await Promise.resolve(fn());
        } finally {
            unlock();
        }
    }
}

// Global mutex instance for the database file
const dbMutex = new Mutex();

export class JsonDb {

    private static getDbPath(): string {
        const libraryPath = getLibraryPath();
        return path.join(libraryPath, 'lectro_data.json');
    }

    /**
     * Reads the database file. Safe to use concurrently but does not lock for writing.
     * To ensure atomic read-modify-write, use update().
     */
    static async read(): Promise<any> {
        return dbMutex.dispatch(async () => {
            const dbPath = this.getDbPath();
            if (!fs.existsSync(dbPath)) return null;
            try {
                const content = fs.readFileSync(dbPath, 'utf8'); // Sync read is fine inside mutex dispatch
                return JSON.parse(content);
            } catch (e) {
                console.error('[JsonDb] Read error:', e);
                return null;
            }
        });
    }

    /**
     * Atomically reads, allows modification via callback, and writes the database.
     * The callback receives the current data and should return the modified data.
     * If callback returns null/undefined, write is skipped.
     */
    static async update(callback: (data: any) => Promise<any> | any): Promise<void> {
        await dbMutex.dispatch(async () => {
            const dbPath = this.getDbPath();
            let data: any = { books: [], tags: [], annotations: [], readingSessions: [], userBookData: [], users: [] };

            // 1. Read
            if (fs.existsSync(dbPath)) {
                try {
                    const content = fs.readFileSync(dbPath, 'utf8');
                    data = JSON.parse(content);
                } catch (e) {
                    console.error('[JsonDb] Update: Read error, starting clean.', e);
                }
            }

            // 2. Modify
            try {
                const modifiedData = await Promise.resolve(callback(data));

                if (modifiedData) {
                    // 3. Write
                    const tmpPath = `${dbPath}.tmp`;
                    fs.writeFileSync(tmpPath, JSON.stringify(modifiedData, null, 2));
                    fs.renameSync(tmpPath, dbPath); // Atomic replace
                    console.log('[JsonDb] Write successful.');
                } else {
                    console.log('[JsonDb] Update skipped (no data returned).');
                }
            } catch (e) {
                console.error('[JsonDb] Callback or Write error:', e);
                throw e; // Re-throw to caller
            }
        });
    }
}
