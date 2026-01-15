import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'library', 'lectro_data.json');

if (fs.existsSync(DB_PATH)) {
    const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    const initialLength = data.books.length;
    data.books = data.books.filter((b: any) => b.id !== 'dummy-book');

    if (data.books.length < initialLength) {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
        console.log('Removed dummy book from DB');
    } else {
        console.log('Dummy book not found in DB');
    }
}
