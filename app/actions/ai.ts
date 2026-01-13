'use server';

import { generateRagResponse, RagContext } from '@/lib/ai/gemini';

export async function getRagResponseAction(
    query: string,
    contexts: RagContext[],
    conversationHistory: { role: 'user' | 'assistant'; content: string }[] = []
) {
    // Check if API key is configured
    if (!process.env.GEMINI_API_KEY) {
        console.error('Gemini API key is missing in server environment');
        return { success: false, error: 'Configuration Error: Gemini API Key is missing on the server.' };
    }

    try {
        const result = await generateRagResponse(query, contexts, conversationHistory);
        return { success: true, data: result };
    } catch (error: any) {
        console.error('Error in getRagResponseAction:', error);
        // Return the actual error message to help debugging
        return { success: false, error: error.message || 'Failed to generate response' };
    }
}
