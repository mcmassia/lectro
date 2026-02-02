'use client';

import { useState, useEffect, useRef } from 'react';
import { Annotation, Book } from '@/lib/db';
import { Send, Sparkles, MessageCircle } from 'lucide-react';
import { getRagResponseAction } from '@/app/actions/ai';
import ReactMarkdown from 'react-markdown';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

interface NotesAIChatProps {
    notes: Annotation[];
    books: Book[];
}

export function NotesAIChat({ notes, books }: NotesAIChatProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isSending, setIsSending] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    // Build context from user's notes
    const buildNotesContext = () => {
        // Group notes by book
        const notesByBook = new Map<string, { book: Book; notes: Annotation[] }>();

        notes.forEach(note => {
            const book = books.find(b => b.id === note.bookId);
            if (!book) return;

            if (!notesByBook.has(book.id)) {
                notesByBook.set(book.id, { book, notes: [] });
            }
            notesByBook.get(book.id)!.notes.push(note);
        });

        // Create context string
        const contextParts: string[] = [];
        notesByBook.forEach(({ book, notes: bookNotes }) => {
            const notesText = bookNotes
                .slice(0, 10) // Limit notes per book
                .map(n => `- "${n.text}"${n.note ? ` (Nota del usuario: ${n.note})` : ''}`)
                .join('\n');

            contextParts.push(`## ${book.title} (${book.author})\n${notesText}`);
        });

        return contextParts.slice(0, 5).join('\n\n'); // Limit to 5 books
    };

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
            const notesContext = buildNotesContext();

            const contexts = [{
                bookId: 'notes-collection',
                bookTitle: 'Colección de Notas del Usuario',
                chapterTitle: 'Notas y Reflexiones',
                content: `El usuario tiene ${notes.length} notas de ${books.length} libros diferentes. Aquí están algunas de sus notas más recientes:\n\n${notesContext}`
            }];

            const history = messages.map(m => ({ role: m.role, content: m.content }));

            const result = await getRagResponseAction(
                userMsg.content,
                contexts,
                history,
                'gemini-2.5-flash',
                undefined,
                'Eres un asistente de análisis literario. El usuario te hace preguntas sobre sus notas de lectura. Responde en español, de forma clara y concisa. Ayuda al usuario a encontrar conexiones entre sus notas, identificar temas recurrentes y profundizar en sus reflexiones.'
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
                content: 'Lo siento, hubo un error al procesar tu pregunta. Por favor, inténtalo de nuevo.',
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsSending(false);
        }
    };

    const suggestions = [
        "¿Cuáles son los temas recurrentes en mis notas?",
        "¿Qué conexiones hay entre mis lecturas?",
        "Resúmeme mis últimas reflexiones"
    ];

    return (
        <aside className="notes-chat-panel">
            {/* Header */}
            <div className="chat-header">
                <div className="header-title">
                    <Sparkles size={18} className="text-accent" />
                    <span>Asistente de Notas</span>
                </div>
                <div className="badge-beta">Beta</div>
            </div>

            {/* Messages Area */}
            <div className="messages-container" ref={scrollRef}>
                {messages.length === 0 ? (
                    <div className="empty-state">
                        <MessageCircle size={40} className="empty-icon" />
                        <h3>Pregúntame sobre tus notas</h3>
                        <p>Puedo ayudarte a encontrar conexiones, identificar temas y reflexionar sobre tus lecturas.</p>

                        <div className="suggestions">
                            {suggestions.map((suggestion, i) => (
                                <button
                                    key={i}
                                    onClick={() => setInput(suggestion)}
                                    className="suggestion-btn"
                                >
                                    {suggestion}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    messages.map(msg => (
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
                        </div>
                    ))
                )}

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

            {/* Input Area */}
            <div className="input-area">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Escribe tu pregunta..."
                    disabled={isSending || notes.length === 0}
                />
                <button
                    className="send-btn"
                    onClick={handleSend}
                    disabled={!input.trim() || isSending || notes.length === 0}
                >
                    <Send size={18} />
                </button>
            </div>

            <style jsx>{`
                .notes-chat-panel {
                    width: 380px;
                    background: var(--color-bg-secondary);
                    border-left: 1px solid var(--color-border);
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    overflow: hidden;
                }

                .chat-header {
                    padding: 16px 20px;
                    border-bottom: 1px solid var(--color-border);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: var(--color-bg-tertiary);
                }

                .header-title {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    font-weight: 600;
                    font-size: 14px;
                    color: var(--color-text-primary);
                }

                .text-accent {
                    color: var(--color-accent);
                }

                .badge-beta {
                    font-size: 10px;
                    font-weight: 600;
                    color: var(--color-text-tertiary);
                    background: var(--color-bg-elevated);
                    padding: 2px 8px;
                    border-radius: 10px;
                    border: 1px solid var(--color-border);
                }

                .messages-container {
                    flex: 1;
                    overflow-y: auto;
                    padding: 20px;
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }

                .empty-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 100%;
                    text-align: center;
                    padding: 20px;
                }

                .empty-icon {
                    color: var(--color-text-tertiary);
                    margin-bottom: 16px;
                    opacity: 0.5;
                }

                .empty-state h3 {
                    font-size: 16px;
                    font-weight: 600;
                    color: var(--color-text-primary);
                    margin-bottom: 8px;
                }

                .empty-state p {
                    font-size: 13px;
                    color: var(--color-text-secondary);
                    line-height: 1.5;
                    margin-bottom: 24px;
                }

                .suggestions {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    width: 100%;
                }

                .suggestion-btn {
                    background: var(--color-bg-tertiary);
                    border: 1px solid var(--color-border);
                    padding: 10px 14px;
                    border-radius: 12px;
                    font-size: 12px;
                    color: var(--color-text-primary);
                    cursor: pointer;
                    transition: all 0.2s;
                    text-align: left;
                }

                .suggestion-btn:hover {
                    background: var(--color-bg-elevated);
                    border-color: var(--color-accent);
                }

                .message {
                    display: flex;
                    flex-direction: column;
                    max-width: 90%;
                    animation: slideIn 0.2s ease-out;
                }

                .message.user {
                    align-self: flex-end;
                    align-items: flex-end;
                }

                .message.assistant {
                    align-self: flex-start;
                    align-items: flex-start;
                }

                .message-content {
                    padding: 12px 16px;
                    border-radius: 16px;
                    font-size: 13px;
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

                .input-area {
                    padding: 16px;
                    border-top: 1px solid var(--color-border);
                    display: flex;
                    gap: 10px;
                    background: var(--color-bg-secondary);
                }

                .input-area input {
                    flex: 1;
                    padding: 10px 16px;
                    border-radius: 20px;
                    border: 1px solid var(--color-border);
                    background: var(--color-bg-tertiary);
                    color: var(--color-text-primary);
                    font-size: 13px;
                }

                .input-area input:focus {
                    outline: none;
                    border-color: var(--color-accent);
                }

                .input-area input:disabled {
                    opacity: 0.5;
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
                    flex-shrink: 0;
                }

                .send-btn:hover:not(:disabled) {
                    transform: scale(1.05);
                }

                .send-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

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

                @keyframes slideIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                /* Markdown Styles */
                .markdown-content :global(p) { margin-bottom: 8px; }
                .markdown-content :global(p:last-child) { margin-bottom: 0; }
                .markdown-content :global(ul), .markdown-content :global(ol) { padding-left: 20px; margin-bottom: 8px; }
                .markdown-content :global(li) { margin-bottom: 4px; }
                .markdown-content :global(strong) { font-weight: 700; }

                @media (max-width: 1280px) {
                    .notes-chat-panel {
                        display: none;
                    }
                }
            `}</style>
        </aside>
    );
}
