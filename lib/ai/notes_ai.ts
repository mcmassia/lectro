import { geminiPro } from './gemini';

// ===================================
// Notes AI Features
// ===================================

export interface NoteCluster {
    topic: string;
    description: string;
    noteIds: string[];
}

export interface NoteFlashcard {
    front: string;
    back: string;
    noteId: string;
}

export async function clusterNotes(notes: { id: string; text: string; note?: string }[]): Promise<NoteCluster[]> {
    if (notes.length < 3) return [];

    const notesText = notes.map(n => `ID: ${n.id}\nContent: "${n.text}"\nUser Note: "${n.note || ''}"`).join('\n\n');

    const prompt = `Analyze the following notes and group them into 3-5 thematic clusters.
    
    Notes:
    ${notesText}
    
    Respond with a JSON array of objects:
    [
      {
        "topic": "Topic Name",
        "description": "Brief explanation of the connection",
        "noteIds": ["id1", "id2"]
      }
    ]
    
    Respond ONLY with the JSON.`;

    try {
        const result = await geminiPro.generateContent(prompt);
        const response = result.response.text();
        const jsonMatch = response.match(/\[[\s\S]*\]/);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    } catch (error) {
        console.error('Clustering error:', error);
        return [];
    }
}

export async function generateFlashcards(noteText: string, context?: string): Promise<NoteFlashcard[]> {
    const prompt = `Create 1-3 Anki-style flashcards based on this text.
    
    Text: "${noteText}"
    ${context ? `Context: "${context}"` : ''}
    
    Respond with a JSON array:
    [
      { "front": "Question", "back": "Answer" }
    ]
    
    Respond ONLY with the JSON.`;

    try {
        const result = await geminiPro.generateContent(prompt);
        const response = result.response.text();
        const jsonMatch = response.match(/\[[\s\S]*\]/);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    } catch (error) {
        console.error('Flashcard generation error:', error);
        return [];
    }
}

export async function synthesizeNotes(notes: { text: string; note?: string }[]): Promise<string> {
    const notesText = notes.map(n => `"${n.text}" ${n.note ? `(User thought: ${n.note})` : ''}`).join('\n');

    const prompt = `Synthesize the following notes into a coherent executive summary or insight paragraph. Connect the ideas logically.
    
    Notes:
    ${notesText}`;

    try {
        const result = await geminiPro.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        console.error('Synthesis error:', error);
        return "Failed to generate synthesis.";
    }
}
