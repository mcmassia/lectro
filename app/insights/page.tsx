'use client';

import { useState, useRef, useEffect } from 'react';
import { useAIStore, RagMessage, RagSource } from '@/stores/appStore';
import type { RagContext } from '@/lib/ai/gemini';
import { getRagResponseAction } from '@/app/actions/ai';
import { getAllVectorChunks, getAllBooks, Book, db } from '@/lib/db';
import { v4 as uuid } from 'uuid';

const SendIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
        <line x1="22" y1="2" x2="11" y2="13" />
        <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
);

const BookIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
);

export default function InsightsPage() {
    const { ragMessages, addRagMessage, isGenerating, setIsGenerating, clearRagMessages, aiModel } = useAIStore();
    const [input, setInput] = useState('');
    const [books, setBooks] = useState<Book[]>([]);
    const [chunkCount, setChunkCount] = useState<number>(0);
    const [indexingStatus, setIndexingStatus] = useState<any>(null); // Use proper type
    const [isIndexing, setIsIndexing] = useState(false);
    const indexerRef = useRef<any>(null); // To store indexer instance
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        async function loadData() {
            const allBooks = await getAllBooks();
            setBooks(allBooks);
            const count = await db.vectorChunks.count();
            setChunkCount(count);
        }
        loadData();

        return () => {
            if (indexerRef.current) {
                indexerRef.current.cancel();
            }
        }
    }, []);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [ragMessages]);

    const handleToggleIndexing = async () => {
        if (isIndexing) {
            if (indexerRef.current) {
                indexerRef.current.cancel();
            }
            setIsIndexing(false);
            return;
        }

        setIsIndexing(true);
        // import dynamically to avoid processing payload on initial load? optional
        const { LibraryIndexer } = await import('@/lib/ai/indexer');

        indexerRef.current = new LibraryIndexer((status) => {
            setIndexingStatus(status);
            if (!status.isIndexing && status.currentBook === 'Completed') {
                setIsIndexing(false);
            }
        });

        // Start indexing in background
        indexerRef.current.indexLibrary().catch((err: any) => {
            console.error("Indexing failed:", err);
            setIsIndexing(false);
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isGenerating) return;

        const userMessage: RagMessage = {
            id: uuid(),
            role: 'user',
            content: input.trim(),
            timestamp: new Date(),
        };

        addRagMessage(userMessage);
        setInput('');
        setIsGenerating(true);

        try {
            // Get vector chunks for context
            // Get vector chunks for context
            const chunks = await getAllVectorChunks();
            let contexts: RagContext[] = [];

            if (chunks.length > 0) {
                // Generate embedding for user query
                const { generateEmbeddingAction } = await import('@/app/actions/ai');
                const { cosineSimilarity } = await import('@/lib/ai/gemini');

                const embeddingResult = await generateEmbeddingAction(input.trim());

                if (embeddingResult.success && embeddingResult.embedding) {
                    const queryEmbedding = embeddingResult.embedding;

                    // Calculate similarity for all chunks
                    const rankedChunks = chunks.map(chunk => ({
                        ...chunk,
                        similarity: cosineSimilarity(queryEmbedding, chunk.embedding)
                    }))
                        .sort((a, b) => b.similarity - a.similarity)
                        .slice(0, 10); // Take top 10 most relevant chunks

                    contexts = rankedChunks.map(chunk => {
                        const book = books.find(b => b.id === chunk.bookId);
                        return {
                            bookId: chunk.bookId,
                            bookTitle: book?.title || 'Libro',
                            chapterTitle: chunk.chapterTitle || 'Capítulo',
                            content: chunk.text,
                            cfi: chunk.startCfi,
                        };
                    });
                } else {
                    console.error('Failed to generate query embedding:', embeddingResult.error);
                    // Fallback to random/first chunks if embedding fails
                    contexts = chunks.slice(0, 5).map(chunk => {
                        const book = books.find(b => b.id === chunk.bookId);
                        return {
                            bookId: chunk.bookId,
                            bookTitle: book?.title || 'Libro',
                            chapterTitle: chunk.chapterTitle || 'Capítulo',
                            content: chunk.text,
                            cfi: chunk.startCfi,
                        };
                    });
                }
            } else {
                // Demo context from book metadata
                // Add explicit warning in chat that indexing is needed
                addRagMessage({
                    id: uuid(),
                    role: 'assistant',
                    content: '⚠️ Tu biblioteca no está indexada. Para que pueda consultar todos tus libros, necesitas generar el índice vectorial. Por ahora, solo puedo ver los títulos y autores.',
                    timestamp: new Date(),
                });

                contexts = books.slice(0, 5).map(book => ({
                    bookId: book.id,
                    bookTitle: book.title,
                    chapterTitle: 'Metadatos',
                    content: `Libro: ${book.title} por ${book.author}. ${book.metadata.description || ''}`,
                }));
            }

            // Get conversation history
            const history = ragMessages.map(msg => ({
                role: msg.role,
                content: msg.content,
            }));

            const result = await getRagResponseAction(
                userMessage.content,
                contexts,
                history,
                aiModel || 'gemini-2.5-flash'
            );

            if (!result.success || !result.data) {
                throw new Error(result.error || 'Failed to generate response');
            }

            const { response, usedSources } = result.data;

            const sources: RagSource[] = usedSources.map(src => ({
                bookId: src.bookId,
                bookTitle: src.bookTitle,
                chapterTitle: src.chapterTitle,
                excerpt: src.content.slice(0, 100) + '...',
                cfi: src.cfi,
            }));

            const assistantMessage: RagMessage = {
                id: uuid(),
                role: 'assistant',
                content: response,
                sources: sources.length > 0 ? sources : undefined,
                timestamp: new Date(),
            };

            addRagMessage(assistantMessage);
        } catch (error: any) {
            console.error('RAG error:', error);
            addRagMessage({
                id: uuid(),
                role: 'assistant',
                content: error.message || 'Lo siento, hubo un error al procesar tu pregunta. Por favor, intenta de nuevo.',
                timestamp: new Date(),
            });
        } finally {
            setIsGenerating(false);
        }
    };

    const suggestedQueries = [
        '¿Qué libros tengo sobre productividad?',
        '¿Cuáles son los temas principales de mi biblioteca?',
        '¿Qué ideas comparten mis libros?',
        'Resume los puntos clave de mis lecturas recientes',
    ];

    return (
        <div className="page-container animate-fade-in">
            <div className="page-header">
                <h1 className="page-title">Insights</h1>
                <p className="page-subtitle">
                    Chat con tu biblioteca usando inteligencia artificial
                </p>
            </div>

            <div className="insights-container">
                <div className="chat-container card-elevated">
                    <div className="chat-messages">
                        {ragMessages.length === 0 ? (
                            <div className="chat-empty">
                                <div className="empty-icon">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48">
                                        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                                    </svg>
                                </div>
                                <h3>Pregunta a tu biblioteca</h3>
                                <p>
                                    Haz preguntas sobre tus libros y obtén respuestas basadas en tu colección
                                </p>
                                <div className="suggested-queries">
                                    {suggestedQueries.map((query, i) => (
                                        <button
                                            key={i}
                                            className="suggested-query"
                                            onClick={() => setInput(query)}
                                        >
                                            {query}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <>
                                {ragMessages.map((message) => (
                                    <div
                                        key={message.id}
                                        className={`message ${message.role}`}
                                    >
                                        <div className="message-content">
                                            <p>{message.content}</p>
                                            {message.sources && message.sources.length > 0 && (
                                                <div className="message-sources">
                                                    <span className="sources-label">Fuentes:</span>
                                                    {message.sources.map((source, i) => (
                                                        <span key={i} className="source-tag">
                                                            <BookIcon />
                                                            {source.bookTitle}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {isGenerating && (
                                    <div className="message assistant">
                                        <div className="message-content typing">
                                            <span className="dot" />
                                            <span className="dot" />
                                            <span className="dot" />
                                        </div>
                                    </div>
                                )}
                                <div ref={chatEndRef} />
                            </>
                        )}
                    </div>

                    <form className="chat-input-container" onSubmit={handleSubmit}>
                        <input
                            type="text"
                            className="input chat-input"
                            placeholder="Pregunta sobre tus libros..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            disabled={isGenerating}
                        />
                        <button
                            type="submit"
                            className="btn btn-primary btn-icon"
                            disabled={!input.trim() || isGenerating}
                        >
                            <SendIcon />
                        </button>
                    </form>
                </div>

                {/* Indexing Sidebar Panel */}
                <div className="insights-sidebar">
                    <div className="card">
                        <h3 className="heading-4">Tu biblioteca</h3>
                        <p className="body-small" style={{ marginTop: 'var(--space-2)' }}>
                            {books.length} libros disponibles
                        </p>
                        <p className="body-xs" style={{ marginTop: 'var(--space-1)', color: 'var(--color-text-tertiary)' }}>
                            {chunkCount} fragmentos vectoriales
                        </p>

                        {/* Indexing Status */}
                        <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-3)', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                                <span className="body-small font-bold">Estado del Índice</span>
                                <span className={`status-dot ${isIndexing ? 'active' : ''}`} />
                            </div>

                            {indexingStatus ? (
                                <div className="indexing-progress">
                                    <div className="progress-bar">
                                        <div
                                            className="progress-fill"
                                            style={{ width: `${(indexingStatus.processedBooks / indexingStatus.totalBooks) * 100}%` }}
                                        />
                                    </div>
                                    <div className="body-xs" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-1)' }}>
                                        <span>{indexingStatus.processedBooks} / {indexingStatus.totalBooks}</span>
                                        <span>{Math.round((indexingStatus.processedBooks / indexingStatus.totalBooks) * 100)}%</span>
                                    </div>
                                    {indexingStatus.currentBook && (
                                        <p className="body-xs truncate" style={{ marginTop: 'var(--space-2)', color: 'var(--color-text-tertiary)' }}>
                                            Procesando: {indexingStatus.currentBook}
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <p className="body-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                                    Biblioteca no indexada o parcialmente indexada.
                                </p>
                            )}

                            <button
                                className={`btn btn-sm ${isIndexing ? 'btn-danger' : 'btn-primary'}`}
                                style={{ width: '100%', marginTop: 'var(--space-3)' }}
                                onClick={handleToggleIndexing}
                            >
                                {isIndexing ? 'Detener Indexación' : 'Indexar Biblioteca'}
                            </button>
                        </div>

                        <div className="library-preview">
                            {books.slice(0, 5).map((book) => (
                                <div key={book.id} className="library-item">
                                    <BookIcon />
                                    <span className="truncate">{book.title}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {ragMessages.length > 0 && (
                        <button
                            className="btn btn-ghost"
                            onClick={clearRagMessages}
                            style={{ width: '100%' }}
                        >
                            Limpiar conversación
                        </button>
                    )}
                </div>
            </div>

            <style jsx>{`
         .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: var(--color-text-tertiary);
         }
         .status-dot.active {
            background: var(--color-success);
            box-shadow: 0 0 8px var(--color-success);
         }
         .progress-bar {
            height: 4px;
            background: var(--color-border);
            border-radius: var(--radius-full);
            overflow: hidden;
         }
         .progress-fill {
            height: 100%;
            background: var(--color-accent);
            transition: width 0.3s ease;
         }
        
        .insights-container {
          display: grid;
          grid-template-columns: 1fr 280px;
          gap: var(--space-6);
          height: calc(100vh - 200px);
        }

        .chat-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
        }

        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: var(--space-4);
        }

        .chat-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          text-align: center;
          color: var(--color-text-secondary);
        }

        .empty-icon {
          color: var(--color-text-tertiary);
          margin-bottom: var(--space-4);
        }

        .chat-empty h3 {
          font-size: var(--text-xl);
          color: var(--color-text-primary);
          margin-bottom: var(--space-2);
        }

        .suggested-queries {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-2);
          justify-content: center;
          margin-top: var(--space-6);
          max-width: 500px;
        }

        .suggested-query {
          padding: var(--space-2) var(--space-4);
          font-size: var(--text-sm);
          background: var(--color-accent-subtle);
          color: var(--color-accent);
          border: 1px solid var(--color-accent);
          border-radius: var(--radius-full);
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .suggested-query:hover {
          background: var(--color-accent);
          color: white;
        }

        .message {
          display: flex;
          margin-bottom: var(--space-4);
        }

        .message.user {
          justify-content: flex-end;
        }

        .message-content {
          max-width: 80%;
          padding: var(--space-3) var(--space-4);
          border-radius: var(--radius-lg);
        }

        .message.user .message-content {
          background: var(--gradient-accent);
          color: white;
          border-bottom-right-radius: var(--radius-sm);
        }

        .message.assistant .message-content {
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-bottom-left-radius: var(--radius-sm);
        }

        .message-content p {
          line-height: 1.6;
          white-space: pre-wrap;
        }

        .message-sources {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-2);
          margin-top: var(--space-3);
          padding-top: var(--space-3);
          border-top: 1px solid var(--color-border);
        }

        .sources-label {
          font-size: var(--text-xs);
          color: var(--color-text-tertiary);
          width: 100%;
        }

        .source-tag {
          display: inline-flex;
          align-items: center;
          gap: var(--space-1);
          padding: var(--space-1) var(--space-2);
          font-size: var(--text-xs);
          background: var(--color-accent-subtle);
          color: var(--color-accent);
          border-radius: var(--radius-sm);
        }

        .message-content.typing {
          display: flex;
          gap: var(--space-1);
          padding: var(--space-4);
        }

        .dot {
          width: 8px;
          height: 8px;
          background: var(--color-text-tertiary);
          border-radius: 50%;
          animation: bounce 1.4s infinite ease-in-out both;
        }

        .dot:nth-child(1) { animation-delay: -0.32s; }
        .dot:nth-child(2) { animation-delay: -0.16s; }

        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }

        .chat-input-container {
          display: flex;
          gap: var(--space-3);
          padding: var(--space-4);
          border-top: 1px solid var(--color-border);
        }

        .chat-input {
          flex: 1;
        }

        .insights-sidebar {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }

        .library-preview {
          margin-top: var(--space-4);
        }

        .library-item {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-2);
          font-size: var(--text-sm);
          color: var(--color-text-secondary);
          border-radius: var(--radius-md);
          transition: all var(--transition-fast);
        }

        .library-item:hover {
          background: var(--color-bg-tertiary);
          color: var(--color-text-primary);
        }

        @media (max-width: 768px) {
          .insights-container {
            grid-template-columns: 1fr;
          }

          .insights-sidebar {
            display: none;
          }
        }
      `}</style>
        </div >
    );
}
