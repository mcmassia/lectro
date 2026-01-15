import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'library', 'lectro_data.json');

const DUMMY_BOOK = {
    id: 'dummy-book',
    title: 'Dummy Book',
    author: 'Test Bot',
    format: 'epub',
    fileName: 'dummy.epub',
    filePath: 'dummy.epub', // Relative to library root in this setup
    fileSize: 1000,
    addedAt: new Date().toISOString(),
    progress: 0,
    currentPosition: "",
    metadata: {
        description: "A dummy book for verification."
    },
    status: 'unread'
};

const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

// Remove if exists
const idx = data.books.findIndex((b: any) => b.id === 'dummy-book');
if (idx !== -1) data.books.splice(idx, 1);

data.books.push(DUMMY_BOOK);
fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
console.log('Added dummy book to DB');
