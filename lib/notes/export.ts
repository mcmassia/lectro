import { Annotation } from '../db';
import { jsPDF } from 'jspdf';
import { saveAs } from 'file-saver';

export async function exportNotes(notes: Annotation[], format: 'json' | 'csv' | 'markdown' | 'pdf', bookTitle?: string) {
    const filename = `lectro-notes-${bookTitle || 'all'}-${new Date().toISOString().split('T')[0]}`;

    switch (format) {
        case 'json':
            const jsonBlob = new Blob([JSON.stringify(notes, null, 2)], { type: 'application/json' });
            saveAs(jsonBlob, `${filename}.json`);
            break;

        case 'csv':
            const csvHeader = 'BookId,IsFavorite,Color,Text,Note,Created At\n';
            const csvRows = notes.map(n => {
                const cleanText = n.text.replace(/"/g, '""');
                const cleanNote = (n.note || '').replace(/"/g, '""');
                return `${n.bookId},${n.isFavorite},${n.color},"${cleanText}","${cleanNote}",${n.createdAt}`;
            }).join('\n');
            const csvBlob = new Blob([csvHeader + csvRows], { type: 'text/csv;charset=utf-8;' });
            saveAs(csvBlob, `${filename}.csv`);
            break;

        case 'markdown':
            let mdContent = `# Notas ${bookTitle ? `- ${bookTitle}` : ''}\n\n`;
            notes.forEach(n => {
                mdContent += `> ${n.text}\n\n`;
                if (n.note) mdContent += `**Nota:** ${n.note}\n\n`;
                mdContent += `*${new Date(n.createdAt).toLocaleDateString()}* - #${n.tags?.join(' #') || ''}\n\n---\n\n`;
            });
            const mdBlob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8;' });
            saveAs(mdBlob, `${filename}.md`);
            break;

        case 'pdf':
            // Basic PDF implementation
            // For a real app, use a library like react-pdf-renderer or similar for better styling
            const doc = new jsPDF();
            let y = 10;
            doc.setFontSize(16);
            doc.text(`Notas ${bookTitle ? `- ${bookTitle}` : ''}`, 10, y);
            y += 10;

            doc.setFontSize(10);
            notes.forEach(n => {
                if (y > 280) { doc.addPage(); y = 10; }

                const textLines = doc.splitTextToSize(`"${n.text}"`, 180);
                doc.setTextColor(100);
                doc.text(textLines, 10, y);
                y += (textLines.length * 5) + 2;

                if (n.note) {
                    const noteLines = doc.splitTextToSize(`Nota: ${n.note}`, 180);
                    doc.setTextColor(0);
                    doc.text(noteLines, 15, y);
                    y += (noteLines.length * 5) + 2;
                }
                y += 5;
            });
            doc.save(`${filename}.pdf`);
            break;
    }
}
