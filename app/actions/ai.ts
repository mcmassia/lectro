'use server';

import { generateRagResponse, RagContext } from '@/lib/ai/gemini';
import { XRayResult } from '@/lib/ai/gemini';

export async function getRagResponseAction(
    query: string,
    contexts: RagContext[],
    conversationHistory: { role: 'user' | 'assistant'; content: string }[] = [],
    modelName: string = 'gemini-2.5-flash'
) {
    // Check if API key is configured
    if (!process.env.GEMINI_API_KEY) {
        console.error('Gemini API key is missing in server environment');
        return { success: false, error: 'Configuration Error: Gemini API Key is missing on the server.' };
    }

    try {
        const result = await generateRagResponse(query, contexts, conversationHistory, modelName);
        return { success: true, data: result };
    } catch (error: any) {
        console.error('Error in getRagResponseAction:', error);
        // Return the actual error message to help debugging
        return { success: false, error: error.message || 'Failed to generate response' };
    }
}

export async function generateEmbeddingAction(text: string): Promise<{ success: boolean; embedding?: number[]; error?: string }> {
    if (!process.env.GEMINI_API_KEY) {
        return { success: false, error: 'Configuration Error: Gemini API Key is missing.' };
    }

    try {
        const { generateEmbedding } = await import('@/lib/ai/gemini');
        const embedding = await generateEmbedding(text);
        return { success: true, embedding };
    } catch (error: any) {
        console.error('Embedding error:', error);
        return { success: false, error: error.message || 'Failed to generate embedding' };
    }
}

export async function generateXRayAction(content: string, title: string, modelName: string = 'gemini-1.5-pro'): Promise<{ success: boolean; data?: XRayResult; error?: string }> {
    if (!process.env.GEMINI_API_KEY) {
        return { success: false, error: 'Configuration Error: Gemini API Key is missing.' };
    }

    try {
        const { generateXRay } = await import('@/lib/ai/gemini');
        const data = await generateXRay(content, title, modelName);
        return { success: true, data };
    } catch (error: any) {
        console.error('X-Ray error:', error);
        return { success: false, error: error.message || 'Failed to generate X-Ray' };
    }
}
