import AdmZip from 'adm-zip';
import fs from 'fs';
import path from 'path';

const LIBRARY_PATH = path.join(process.cwd(), 'library');
const OUTPUT_FILE = path.join(LIBRARY_PATH, 'dummy.epub');

if (!fs.existsSync(LIBRARY_PATH)) {
    fs.mkdirSync(LIBRARY_PATH, { recursive: true });
}

const zip = new AdmZip();

// 1. mimetype (must be first, no compression)
zip.addFile('mimetype', Buffer.from('application/epub+zip'));

// 2. META-INF/container.xml
const containerXml = `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
    <rootfiles>
        <rootfile full-path="content.opf" media-type="application/oebps-package+xml"/>
    </rootfiles>
</container>`;
zip.addFile('META-INF/container.xml', Buffer.from(containerXml));

// 3. content.opf
const contentOpf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookID" version="2.0">
    <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
        <dc:title>Dummy Book</dc:title>
        <dc:creator>Test Bot</dc:creator>
        <dc:identifier id="BookID">urn:uuid:dummy-1234</dc:identifier>
        <dc:language>en</dc:language>
    </metadata>
    <manifest>
        <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
        <item id="page1" href="page1.xhtml" media-type="application/xhtml+xml"/>
    </manifest>
    <spine toc="ncx">
        <itemref idref="page1"/>
    </spine>
</package>`;
zip.addFile('content.opf', Buffer.from(contentOpf));

// 4. toc.ncx
const tocNcx = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
    <head><meta name="dtb:uid" content="urn:uuid:dummy-1234"/></head>
    <docTitle><text>Dummy Book</text></docTitle>
    <navMap>
        <navPoint id="navPoint-1" playOrder="1">
            <navLabel><text>Chapter 1</text></navLabel>
            <content src="page1.xhtml"/>
        </navPoint>
    </navMap>
</ncx>`;
zip.addFile('toc.ncx', Buffer.from(tocNcx));

// 5. page1.xhtml
const page1 = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Chapter 1</title></head>
<body>
    <h1>Chapter 1</h1>
    <p>This is a dummy book generated for verification.</p>
</body>
</html>`;
zip.addFile('page1.xhtml', Buffer.from(page1));

// Write to disk
zip.writeZip(OUTPUT_FILE);
console.log(`Created dummy EPUB at ${OUTPUT_FILE}`);
