import { ReadiumHelper } from '../lib/server/readium';

const BOOK_ID = 'dummy-book';

async function main() {
    console.log(`Verifying manifest for book: ${BOOK_ID}`);

    try {
        const helper = new ReadiumHelper(BOOK_ID);

        if (!helper.isUnzipped()) {
            console.log('Book not unzipped. Unzipping...');
            helper.unzip();
        } else {
            console.log('Book already unzipped.');
        }

        const manifest = helper.getManifest();
        console.log(JSON.stringify(manifest, null, 2));

        // Check if reading order has items
        if (!manifest.readingOrder || manifest.readingOrder.length === 0) {
            console.error('❌ ERROR: Reading order is empty!');
        } else {
            console.log(`✅ SUCCESS: Generated manifest with ${manifest.readingOrder.length} spine items.`);
        }

    } catch (e) {
        console.error('❌ CRASH:', e);
    }
}

main();
