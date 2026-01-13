import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

// ===================================
// Gemini Client Configuration
// ===================================

const API_KEY = process.env.GEMINI_API_KEY || '';

if (!API_KEY) {
    console.warn('Gemini API key not found. AI features will be disabled.');
}

const genAI = new GoogleGenerativeAI(API_KEY);

// Models
export const geminiPro = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
export const geminiProVision = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// ===================================
// X-Ray Generation
// ===================================

export interface XRayResult {
    characters: XRayEntity[];
    places: XRayEntity[];
    terms: XRayEntity[];
}

export interface XRayEntity {
    name: string;
    description: string;
    importance: 'main' | 'secondary' | 'minor';
}

export async function generateXRay(bookContent: string, bookTitle: string): Promise<XRayResult> {
    const prompt = `Analyze the following book content and extract key entities. For each entity, provide a brief description and its importance level.

Book Title: ${bookTitle}

Content:
${bookContent.slice(0, 50000)} // Limit to avoid token limits

Please respond with a JSON object in this exact format:
{
  "characters": [
    {"name": "Character Name", "description": "Brief description of the character and their role", "importance": "main|secondary|minor"}
  ],
  "places": [
    {"name": "Place Name", "description": "Brief description of the location and its significance", "importance": "main|secondary|minor"}
  ],
  "terms": [
    {"name": "Technical Term", "description": "Definition and context of the term", "importance": "main|secondary|minor"}
  ]
}

Focus on:
- Characters: Main protagonists, antagonists, and important supporting characters
- Places: Settings, cities, worlds, or significant locations
- Terms: Technical vocabulary, concepts, or invented terms specific to the book

Respond ONLY with the JSON object, no additional text.`;

    try {
        const result = await geminiPro.generateContent(prompt);
        const response = result.response.text();

        // Parse JSON from response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Failed to parse X-Ray response');
        }

        return JSON.parse(jsonMatch[0]) as XRayResult;
    } catch (error) {
        console.error('X-Ray generation error:', error);
        throw error;
    }
}

// ===================================
// Smart Summaries
// ===================================

export interface ChapterSummary {
    chapterTitle: string;
    summary: string;
    keyPoints: string[];
}

export interface ExecutiveSummary {
    overview: string;
    keyIdeas: string[];
    themes: string[];
    takeaways: string[];
}

export async function generateChapterSummary(
    chapterContent: string,
    chapterTitle: string,
    bookTitle: string
): Promise<ChapterSummary> {
    const prompt = `Summarize the following chapter from "${bookTitle}".

Chapter: ${chapterTitle}

Content:
${chapterContent.slice(0, 30000)}

Please provide:
1. A concise summary (2-3 paragraphs)
2. 3-5 key points from this chapter

Respond with a JSON object:
{
  "chapterTitle": "${chapterTitle}",
  "summary": "Your summary here",
  "keyPoints": ["Point 1", "Point 2", "Point 3"]
}

Respond ONLY with the JSON object.`;

    try {
        const result = await geminiPro.generateContent(prompt);
        const response = result.response.text();

        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Failed to parse summary response');
        }

        return JSON.parse(jsonMatch[0]) as ChapterSummary;
    } catch (error) {
        console.error('Chapter summary error:', error);
        throw error;
    }
}

export async function generateExecutiveSummary(
    bookContent: string,
    bookTitle: string,
    author: string
): Promise<ExecutiveSummary> {
    const prompt = `Create an executive summary for the book "${bookTitle}" by ${author}.

Content excerpts:
${bookContent.slice(0, 60000)}

Please provide:
1. A comprehensive overview (2-3 paragraphs)
2. The 5 most important ideas from the book
3. Major themes explored
4. Key takeaways for the reader

Respond with a JSON object:
{
  "overview": "Comprehensive book overview",
  "keyIdeas": ["Idea 1", "Idea 2", "Idea 3", "Idea 4", "Idea 5"],
  "themes": ["Theme 1", "Theme 2"],
  "takeaways": ["Takeaway 1", "Takeaway 2", "Takeaway 3"]
}

Respond ONLY with the JSON object.`;

    try {
        const result = await geminiPro.generateContent(prompt);
        const response = result.response.text();

        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Failed to parse executive summary response');
        }

        return JSON.parse(jsonMatch[0]) as ExecutiveSummary;
    } catch (error) {
        console.error('Executive summary error:', error);
        throw error;
    }
}

// ===================================
// RAG Chat
// ===================================

export interface RagContext {
    bookId: string;
    bookTitle: string;
    chapterTitle: string;
    content: string;
    cfi?: string;
}

export async function generateRagResponse(
    query: string,
    contexts: RagContext[],
    conversationHistory: { role: 'user' | 'assistant'; content: string }[] = [],
    modelName: string = 'gemini-1.5-flash'
): Promise<{ response: string; usedSources: RagContext[] }> {
    const gemini = genAI.getGenerativeModel({ model: modelName });
    const contextText = contexts.map((ctx, i) =>
        `[Source ${i + 1} - "${ctx.bookTitle}", ${ctx.chapterTitle}]:\n${ctx.content}`
    ).join('\n\n');

    const historyText = conversationHistory.map(msg =>
        `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
    ).join('\n');

    const prompt = `You are a knowledgeable assistant helping a user explore their personal book library. Answer questions by synthesizing information from the provided book excerpts.

${historyText ? `Previous conversation:\n${historyText}\n\n` : ''}

User's question: ${query}

Relevant excerpts from the user's library:
${contextText}

Instructions:
1. Synthesize information from multiple sources when relevant
2. Reference specific books when citing information
3. If the excerpts don't contain relevant information, say so honestly
4. Be conversational and insightful
5. Draw connections between different books when appropriate

Provide a helpful, well-structured response.`;

    try {
        const result = await gemini.generateContent(prompt);
        const response = result.response.text();

        // Determine which sources were actually used (simple heuristic)
        const usedSources = contexts.filter(ctx =>
            response.toLowerCase().includes(ctx.bookTitle.toLowerCase())
        );

        return { response, usedSources };
    } catch (error) {
        console.error('RAG response error:', error);
        throw error;
    }
}

// ===================================
// Text Embeddings (for semantic search)
// ===================================

// Note: For production, you'd want to use a proper embedding model
// This is a simplified approach using Gemini for context
// Note: For production, you'd want to use a proper embedding model
// This is a simplified approach using Gemini for context
export async function generateEmbedding(text: string): Promise<number[]> {
    try {
        const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
        const result = await model.embedContent(text);
        return result.embedding.values;
    } catch (error) {
        console.error('Embedding generation failed:', error);
        // Fallback or rethrow? 
        throw error;
    }
}

export function cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
