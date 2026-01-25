"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/stores/appStore';
import { getUser, ensureDefaultUser } from '@/lib/db';
import { verifyPassword } from '@/lib/auth';
import { User, Lock, ArrowRight, BookOpen } from 'lucide-react';

export default function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isInitializing, setIsInitializing] = useState(true);
    const router = useRouter();
    const login = useAppStore(state => state.login);

    // Initialize default user on mount
    useEffect(() => {
        async function init() {
            try {
                await ensureDefaultUser();
            } catch (e) {
                console.error('Failed to seed user', e);
            } finally {
                setIsInitializing(false);
            }
        }
        init();
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const user = await getUser(username);
            if (!user) {
                setError('Usuario no encontrado');
                setIsLoading(false);
                return;
            }

            const isValid = await verifyPassword(password, user.passwordHash);
            if (!isValid) {
                setError('Contraseña incorrecta');
                setIsLoading(false);
                return;
            }

            login(user);
            router.push('/');
        } catch (err) {
            console.error(err);
            setError('Error al iniciar sesión');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-background">
                <div className="orb orb-1"></div>
                <div className="orb orb-2"></div>
                <div className="orb orb-3"></div>
            </div>

            <div className="login-card glass">
                <div className="brand-header">
                    <div className="logo-icon">
                        <BookOpen size={32} />
                    </div>
                    <h1>Lectro</h1>
                    <p>Tu biblioteca personal inteligente</p>
                </div>

                <form onSubmit={handleLogin} className="login-form">
                    <div className="input-group">
                        <div className="input-icon">
                            <User size={18} />
                        </div>
                        <input
                            type="text"
                            placeholder="Nombre de usuario"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            className="input-field"
                        />
                    </div>

                    <div className="input-group">
                        <div className="input-icon">
                            <Lock size={18} />
                        </div>
                        <input
                            type="password"
                            placeholder="Contraseña"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="input-field"
                        />
                    </div>

                    {error && (
                        <div className="error-message">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading || isInitializing}
                        className="login-btn"
                    >
                        {isLoading || isInitializing ? (
                            <span className="loading-dots">Iniciando...</span>
                        ) : (
                            <>
                                <span>Entrar</span>
                                <ArrowRight size={18} />
                            </>
                        )}
                    </button>
                </form>


            </div>

            <style jsx>{`
                .login-container {
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    position: relative;
                    overflow: hidden;
                    background: #0f172a;
                    color: white;
                    font-family: var(--font-inter), sans-serif;
                }

                .login-background {
                    position: absolute;
                    inset: 0;
                    overflow: hidden;
                    z-index: 0;
                }

                .orb {
                    position: absolute;
                    border-radius: 50%;
                    filter: blur(80px);
                    opacity: 0.6;
                    animation: float 20s infinite ease-in-out;
                }

                .orb-1 {
                    top: -10%;
                    left: -10%;
                    width: 50vw;
                    height: 50vw;
                    background: radial-gradient(circle, #4f46e5 0%, transparent 70%);
                    animation-delay: 0s;
                }

                .orb-2 {
                    bottom: -10%;
                    right: -10%;
                    width: 60vw;
                    height: 60vw;
                    background: radial-gradient(circle, #06b6d4 0%, transparent 70%);
                    animation-delay: -5s;
                }

                .orb-3 {
                    top: 40%;
                    left: 40%;
                    width: 40vw;
                    height: 40vw;
                    background: radial-gradient(circle, #8b5cf6 0%, transparent 70%);
                    opacity: 0.4;
                    transform: translate(-50%, -50%);
                    animation-delay: -10s;
                }

                @keyframes float {
                    0%, 100% { transform: translate(0, 0); }
                    33% { transform: translate(30px, -50px); }
                    66% { transform: translate(-20px, 20px); }
                }

                .login-card {
                    position: relative;
                    z-index: 10;
                    width: 100%;
                    max-width: 400px;
                    padding: 40px;
                    border-radius: 24px;
                    background: rgba(255, 255, 255, 0.05);
                    backdrop-filter: blur(20px);
                    -webkit-backdrop-filter: blur(20px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                    display: flex;
                    flex-direction: column;
                    gap: 32px;
                }

                .brand-header {
                    text-align: center;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 12px;
                }

                .logo-icon {
                    width: 64px;
                    height: 64px;
                    background: linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%);
                    border-radius: 16px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 10px 25px -5px rgba(79, 70, 229, 0.5);
                    color: white;
                    margin-bottom: 8px;
                }

                h1 {
                    font-size: 32px;
                    font-weight: 800;
                    letter-spacing: -0.02em;
                    background: linear-gradient(to right, #fff, #cbd5e1);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    margin: 0;
                }

                p {
                    color: #94a3b8;
                    font-size: 14px;
                    margin: 0;
                }

                .login-form {
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                }

                .input-group {
                    position: relative;
                }

                .input-icon {
                    position: absolute;
                    left: 16px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: #94a3b8;
                    pointer-events: none;
                }

                .input-field {
                    width: 100%;
                    background: rgba(15, 23, 42, 0.6);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 12px;
                    padding: 14px 16px 14px 44px;
                    color: white;
                    font-size: 15px;
                    transition: all 0.2s;
                    outline: none;
                }

                .input-field:focus {
                    background: rgba(15, 23, 42, 0.8);
                    border-color: #6366f1;
                    box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1);
                }

                .input-field::placeholder {
                    color: #64748b;
                }

                .login-btn {
                    margin-top: 8px;
                    background: linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%);
                    color: white;
                    border: none;
                    border-radius: 12px;
                    padding: 14px;
                    font-size: 16px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
                }

                .login-btn:hover:not(:disabled) {
                    transform: translateY(-1px);
                    box-shadow: 0 8px 20px rgba(79, 70, 229, 0.4);
                    filter: brightness(1.1);
                }

                .login-btn:active:not(:disabled) {
                    transform: translateY(1px);
                }

                .login-btn:disabled {
                    opacity: 0.7;
                    cursor: not-allowed;
                    filter: grayscale(0.5);
                }

                .error-message {
                    color: #f87171;
                    font-size: 14px;
                    text-align: center;
                    background: rgba(248, 113, 113, 0.1);
                    border: 1px solid rgba(248, 113, 113, 0.2);
                    padding: 10px;
                    border-radius: 8px;
                }

                .footer {
                    text-align: center;
                    font-size: 12px;
                    color: #64748b;
                }

                .footer strong {
                    color: #94a3b8;
                    font-weight: 600;
                }
            `}</style>
        </div>
    );
}
