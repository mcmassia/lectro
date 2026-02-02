'use client';

import { useState, useEffect, useRef } from 'react';
import { Book, XRayData, addAnnotation, Annotation } from '@/lib/db';
import { useAppStore } from '@/stores/appStore';
import { db, VectorChunk } from '@/lib/db';
import { generateEmbeddingAction, getRagResponseAction } from '@/app/actions/ai';
import { Send, Sparkles, Bookmark, BookmarkCheck } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { AIModelSelector, AI_MODELS } from './AIModelSelector';

export interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    isLoading?: boolean;
}

interface BookChatProps {
    book: Book;
    xrayData?: XRayData | null;
    onClose: () => void;
    messages: Message[];
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
    input: string;
    setInput: React.Dispatch<React.SetStateAction<string>>;
    isIndexed?: boolean;
    isIndexing?: boolean;
    onIndexBook?: () => void;
}

export function BookChat({ book, xrayData, onClose, messages, setMessages, input, setInput, isIndexed, isIndexing, onIndexBook }: BookChatProps) {
    const [isSending, setIsSending] = useState(false);
    const [savedMessageIds, setSavedMessageIds] = useState<Set<string>>(new Set());
    const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');
    const scrollRef = useRef<HTMLDivElement>(null);
    const { currentUser } = useAppStore();

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || isSending) return;

        const userMsg: Message = {
            id: crypto.randomUUID(),
            role: 'user',
            content: input.trim(),
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsSending(true);

        try {
            const contexts = [];

            // 1. Add X-Ray context (High Level)
            if (xrayData) {
                const xrayContent = `
Summary: ${xrayData.summary}
Plot: ${xrayData.plot}
Key Points: ${(xrayData.keyPoints || []).join('\n- ')}
Characters: ${xrayData.characters.map(c => `${c.name}: ${c.description}`).join('\n')}
                `.trim();

                contexts.push({
                    bookId: book.id,
                    bookTitle: book.title,
                    chapterTitle: 'AI Analysis',
                    content: xrayContent
                });
            } else {
                contexts.push({
                    bookId: book.id,
                    bookTitle: book.title,
                    chapterTitle: 'Metadata',
                    content: `Title: ${book.title}\nAuthor: ${book.author}\nDescription: ${book.metadata?.description || 'No description available.'}`
                });
            }

            // 2. Client-Side Vector Search (Deep Detail)
            if (isIndexed) {
                console.log('Performing vector search for query:', userMsg.content);
                // a. Generate embedding for query
                const { embedding, error } = await generateEmbeddingAction(userMsg.content);

                if (embedding) {
                    // b. Fetch all chunks for this book
                    const chunks = await db.vectorChunks.where('bookId').equals(book.id).toArray();

                    if (chunks.length > 0) {
                        // c. Cosine Similarity
                        const scoredChunks = chunks.map(chunk => {
                            const similarity = cosineSimilarity(embedding, chunk.embedding);
                            return { ...chunk, score: similarity };
                        });

                        // d. Sort and Slice Top K
                        const topChunks = scoredChunks
                            .sort((a, b) => b.score - a.score)
                            .slice(0, 5);

                        console.log(`Found ${topChunks.length} relevant chunks. Top score: ${topChunks[0]?.score}`);

                        // e. Add to context
                        topChunks.forEach(chunk => {
                            contexts.push({
                                bookId: book.id,
                                bookTitle: book.title,
                                chapterTitle: chunk.chapterTitle || 'Content',
                                content: chunk.text
                            });
                        });
                    }
                } else {
                    console.error('Failed to generate query embedding:', error);
                }
            }

            const history = messages.map(m => ({ role: m.role, content: m.content }));

            const result = await getRagResponseAction(
                userMsg.content,
                contexts,
                history,
                selectedModel
            );

            if (result.success && result.data) {
                const botMsg: Message = {
                    id: crypto.randomUUID(),
                    role: 'assistant',
                    content: result.data.response,
                    timestamp: new Date()
                };
                setMessages(prev => [...prev, botMsg]);
            } else {
                throw new Error(result.error || 'Failed to get response');
            }

        } catch (error) {
            console.error(error);
            const errorMsg: Message = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: 'Sorry, I encountered an error while analyzing the book content.',
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsSending(false);
        }
    };

    // Helper function for Cosine Similarity
    function cosineSimilarity(vecA: number[], vecB: number[]) {
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    const handleSaveAsNote = async (messageId: string, messageContent: string) => {
        if (!currentUser) return;

        const newAnnotation: Annotation = {
            id: crypto.randomUUID(),
            bookId: book.id,
            userId: currentUser.id,
            cfi: '',
            text: '',
            note: messageContent,
            color: 'yellow',
            chapterTitle: 'Respuesta IA',
            createdAt: new Date(),
            updatedAt: new Date()
        };

        await addAnnotation(newAnnotation);
        setSavedMessageIds(prev => new Set(prev).add(messageId));
    };

    return (
        <div className="book-chat-container animate-fade-in">
            {onIndexBook && (
                <div className={`indexing-banner ${isIndexed ? 'indexed' : ''}`}>
                    <div className="banner-content">
                        <Sparkles size={16} />
                        <span>{isIndexed ? 'Libro indexado para respuestas profundas.' : 'Este chat solo usa el resumen X-Ray. Para respuestas precisas sobre todo el contenido:'}</span>
                    </div>
                    <button
                        onClick={onIndexBook}
                        disabled={isIndexing}
                        className="index-btn"
                    >
                        {isIndexing ? 'Indexando...' : (isIndexed ? 'Actualizar Índice' : 'Indexar Profundo')}
                    </button>
                </div>
            )}

            <div className="chat-header hidden">
                <div className="header-title">
                    <Sparkles size={18} className="text-accent" />
                    <h3>Chat con {book.title}</h3>
                </div>
                {/* Close button removed for tab usage */}
            </div>

            <div className="messages-list" ref={scrollRef}>
                {messages.length === 0 && (
                    <div className="empty-chat">
                        <Sparkles size={32} className="mb-2 opacity-50" />
                        <p>Pregúntame algo sobre este libro.</p>
                        <div className="suggestions">
                            <button onClick={() => setInput("¿De qué trata el libro?")}>¿De qué trata?</button>
                            <button onClick={() => setInput("¿Quién es el protagonista?")}>¿Quién es el protagonista?</button>
                            <button onClick={() => setInput("Dime los temas principales")}>Temas principales</button>
                        </div>
                    </div>
                )}

                {messages.map(msg => (
                    <div key={msg.id} className={`message ${msg.role}`}>
                        <div className="message-content">
                            {msg.role === 'assistant' ? (
                                <div className="markdown-content">
                                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                                </div>
                            ) : (
                                msg.content
                            )}
                        </div>
                        {msg.role === 'assistant' && (
                            <button
                                className={`save-note-btn ${savedMessageIds.has(msg.id) ? 'saved' : ''}`}
                                onClick={() => handleSaveAsNote(msg.id, msg.content)}
                                disabled={savedMessageIds.has(msg.id)}
                                title={savedMessageIds.has(msg.id) ? 'Guardado como nota' : 'Guardar como nota'}
                            >
                                {savedMessageIds.has(msg.id) ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
                            </button>
                        )}
                    </div>
                ))}

                {isSending && (
                    <div className="message assistant">
                        <div className="message-content typing">
                            <span className="dot"></span>
                            <span className="dot"></span>
                            <span className="dot"></span>
                        </div>
                    </div>
                )}
            </div>

            <div className="input-area">
                <AIModelSelector
                    selectedModel={selectedModel}
                    onModelChange={setSelectedModel}
                    compact={true}
                />
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Escribe tu mensaje..."
                    disabled={isSending}
                />
                <button
                    className="send-btn"
                    onClick={handleSend}
                    disabled={!input.trim() || isSending}
                >
                    <Send size={18} />
                </button>
            </div>

            <style jsx>{`
                .book-chat-container {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    width: 100%;
                    background: var(--color-bg-secondary);
                    /* border-left removed */
                    border-radius: 12px;
                    overflow: hidden;
                    border: 1px solid var(--color-border);
                }

                .indexing-banner {
                    background: rgba(168, 85, 247, 0.1);
                    border-bottom: 1px solid rgba(168, 85, 247, 0.2);
                    padding: 8px 16px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-size: 13px;
                }
                .indexing-banner.indexed {
                    background: rgba(34, 197, 94, 0.1);
                    border-color: rgba(34, 197, 94, 0.2);
                }
                .indexing-banner.indexed .banner-content { color: #22c55e; }
                .indexing-banner.indexed .index-btn {
                    background: transparent;
                    border: 1px solid #22c55e;
                    color: #22c55e;
                }
                .indexing-banner.indexed .index-btn:hover {
                    background: rgba(34, 197, 94, 0.1);
                }

                .banner-content { display: flex; align-items: center; gap: 8px; color: var(--color-accent); }
                .index-btn {
                    background: var(--color-accent);
                    color: white;
                    border: none;
                    padding: 4px 12px;
                    border-radius: 6px;
                    font-size: 12px;
                    font-weight: 600;
                    cursor: pointer;
                }
                .index-btn:disabled { opacity: 0.7; cursor: wait; }

                .chat-header {
                    padding: 16px;
                    border-bottom: 1px solid var(--color-border);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: var(--color-bg-tertiary);
                }
                .chat-header.hidden { display: none; }

                .header-title {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-weight: 600;
                    color: var(--color-text-primary);
                }
                .text-accent { color: var(--color-accent); }

                .close-btn {
                    background: none;
                    border: none;
                    color: var(--color-text-secondary);
                    cursor: pointer;
                }
                .close-btn:hover { color: var(--color-text-primary); }

                .messages-list {
                    flex: 1;
                    overflow-y: auto;
                    padding: 20px;
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }

                .message {
                    display: flex;
                    flex-direction: column;
                    max-width: 85%;
                }
                .message.user { align-self: flex-end; align-items: flex-end; }
                .message.assistant { align-self: flex-start; align-items: flex-start; position: relative; }

                .save-note-btn {
                    position: absolute;
                    top: 8px;
                    right: -32px;
                    background: transparent;
                    border: none;
                    color: var(--color-text-tertiary);
                    cursor: pointer;
                    padding: 4px;
                    border-radius: 4px;
                    transition: all 0.2s;
                    opacity: 0;
                }
                .message.assistant:hover .save-note-btn {
                    opacity: 1;
                }
                .save-note-btn:hover {
                    color: var(--color-accent);
                    background: var(--color-bg-tertiary);
                }
                .save-note-btn.saved {
                    color: var(--color-accent);
                    opacity: 1;
                }

                .message-content {
                    padding: 12px 16px;
                    border-radius: 12px;
                    font-size: 14px;
                    line-height: 1.5;
                }
                .message.user .message-content {
                    background: var(--color-accent);
                    color: white;
                    border-bottom-right-radius: 4px;
                }
                .message.assistant .message-content {
                    background: var(--color-bg-tertiary);
                    color: var(--color-text-primary);
                    border-bottom-left-radius: 4px;
                }

                .empty-chat {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 100%;
                    color: var(--color-text-secondary);
                    text-align: center;
                }

                .suggestions {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    justify-content: center;
                    margin-top: 16px;
                }
                .suggestions button {
                    background: var(--color-bg-tertiary);
                    border: 1px solid var(--color-border);
                    padding: 6px 12px;
                    border-radius: 99px;
                    font-size: 12px;
                    color: var(--color-text-primary);
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .suggestions button:hover {
                    background: var(--color-bg-elevated);
                    border-color: var(--color-accent);
                }

                .input-area {
                    padding: 16px;
                    border-top: 1px solid var(--color-border);
                    display: flex;
                    gap: 12px;
                    background: var(--color-bg-secondary);
                }

                .input-area input {
                    flex: 1;
                    padding: 10px 16px;
                    border-radius: 20px;
                    border: 1px solid var(--color-border);
                    background: var(--color-bg-tertiary);
                    color: var(--color-text-primary);
                }
                .input-area input:focus {
                    outline: none;
                    border-color: var(--color-accent);
                }

                .send-btn {
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    background: var(--color-accent);
                    color: white;
                    border: none;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: transform 0.2s;
                }
                .send-btn:hover:not(:disabled) { transform: scale(1.05); }
                .send-btn:disabled { opacity: 0.5; cursor: not-allowed; }

                .typing {
                    display: flex;
                    gap: 4px;
                    padding: 12px 16px !important;
                }
                .dot {
                    width: 6px;
                    height: 6px;
                    background: currentColor;
                    border-radius: 50%;
                    animation: bounce 1.4s infinite ease-in-out both;
                    opacity: 0.6;
                }
                .dot:nth-child(1) { animation-delay: -0.32s; }
                .dot:nth-child(2) { animation-delay: -0.16s; }

                @keyframes bounce {
                    0%, 80%, 100% { transform: scale(0); }
                    40% { transform: scale(1); }
                }
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                /* Markdown Styles */
                .markdown-content :global(p) { margin-bottom: 8px; }
                .markdown-content :global(p:last-child) { margin-bottom: 0; }
                .markdown-content :global(ul), .markdown-content :global(ol) { padding-left: 20px; margin-bottom: 8px; }
                .markdown-content :global(li) { margin-bottom: 4px; }
                .markdown-content :global(strong) { font-weight: 700; color: inherit; }
            `}</style>
        </div>
    );
}
