'use server';

import { generateRagResponse, RagContext } from '@/lib/ai/gemini';

export async function getRagResponseAction(
    query: string,
    contexts: RagContext[],
    conversationHistory: { role: 'user' | 'assistant'; content: string }[] = []
) {
    try {
        const result = await generateRagResponse(query, contexts, conversationHistory);
        return { success: true, data: result };
    } catch (error) {
        console.error('Error in getRagResponseAction:', error);
        return { success: false, error: 'Failed to generate response' };
    }
}
