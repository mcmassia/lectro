'use client';

import { useState, useEffect, useRef } from 'react';
import { Book, XRayData } from '@/lib/db';
import { useAppStore } from '@/stores/appStore';
import { getRagResponseAction } from '@/app/actions/ai';
import { Send, User, Sparkles, X } from 'lucide-react';

interface BookChatProps {
    book: Book;
    xrayData?: XRayData | null;
    onClose: () => void;
}

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    isLoading?: boolean;
}

export function BookChat({ book, xrayData, onClose }: BookChatProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isSending, setIsSending] = useState(false);
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
            content: input,
            timestamp: new Date()
        };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsSending(true);

        try {
            // Construct context from X-Ray data
            const contexts = [];

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
                // Fallback context if no X-Ray (chat will be limited)
                contexts.push({
                    bookId: book.id,
                    bookTitle: book.title,
                    chapterTitle: 'Metadata',
                    content: `Title: ${book.title}\nAuthor: ${book.author}\nDescription: ${book.metadata?.description || 'No description available.'}`
                });
            }

            const history = messages.map(m => ({ role: m.role, content: m.content }));

            const result = await getRagResponseAction(
                userMsg.content,
                contexts,
                history
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

    return (
        <div className="book-chat-container animate-slide-up">
            <div className="chat-header">
                <div className="header-title">
                    <Sparkles size={18} className="text-accent" />
                    <h3>Chat con {book.title}</h3>
                </div>
                <button className="close-btn" onClick={onClose}>
                    <X size={18} />
                </button>
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
                            {msg.content}
                        </div>
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
                    border-left: 1px solid var(--color-border);
                }

                .chat-header {
                    padding: 16px;
                    border-bottom: 1px solid var(--color-border);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: var(--color-bg-tertiary);
                }

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
                .message.assistant { align-self: flex-start; align-items: flex-start; }

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
            `}</style>
        </div>
    );
}
