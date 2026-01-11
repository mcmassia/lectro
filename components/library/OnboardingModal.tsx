'use client';

import { useState } from 'react';
import { useAppStore } from '@/stores/appStore';

interface OnboardingModalProps {
    onComplete: () => void;
}

export function OnboardingModal({ onComplete }: OnboardingModalProps) {
    const [step, setStep] = useState(1);
    const { setOnboardingComplete, setLibraryPath, setTheme } = useAppStore();

    const handleComplete = () => {
        setOnboardingComplete(true);
        onComplete();
    };

    const handleSelectFolder = async () => {
        // In a web environment, we can't directly access the filesystem
        // This would work with Electron or a native file picker
        // For now, we'll simulate folder selection

        // In production with Electron:
        // const { dialog } = require('electron').remote;
        // const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });

        // For web demo, we'll use a placeholder
        setLibraryPath('~/Documents/Lectro');
        setStep(3);
    };

    return (
        <div className="modal-overlay open">
            <div className="modal onboarding-modal">
                {step === 1 && (
                    <>
                        <div className="onboarding-content">
                            <div className="onboarding-icon">
                                <svg viewBox="0 0 80 80" fill="none">
                                    <defs>
                                        <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                            <stop offset="0%" stopColor="#007AFF" />
                                            <stop offset="100%" stopColor="#5856D6" />
                                        </linearGradient>
                                    </defs>
                                    <rect width="80" height="80" rx="20" fill="url(#logoGrad)" />
                                    <text x="50%" y="55%" dominantBaseline="middle" textAnchor="middle" fill="white" fontSize="40" fontWeight="700">L</text>
                                </svg>
                            </div>
                            <h2 className="heading-2">Bienvenido a Lectro</h2>
                            <p className="onboarding-description">
                                Tu plataforma de lectura digital con inteligencia artificial.
                                Lee, anota y descubre conexiones entre tus libros.
                            </p>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-primary btn-lg" onClick={() => setStep(2)}>
                                Comenzar
                            </button>
                        </div>
                    </>
                )}

                {step === 2 && (
                    <>
                        <div className="onboarding-content">
                            <div className="onboarding-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.5" width="64" height="64">
                                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                                </svg>
                            </div>
                            <h2 className="heading-2">Configura tu biblioteca</h2>
                            <p className="onboarding-description">
                                Selecciona la carpeta donde guardas tus libros.
                                Lectro sincronizará automáticamente los libros existentes.
                            </p>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setStep(3)}>
                                Saltar
                            </button>
                            <button className="btn btn-primary" onClick={handleSelectFolder}>
                                Seleccionar carpeta
                            </button>
                        </div>
                    </>
                )}

                {step === 3 && (
                    <>
                        <div className="onboarding-content">
                            <div className="onboarding-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.5" width="64" height="64">
                                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                                </svg>
                            </div>
                            <h2 className="heading-2">Elige tu tema</h2>
                            <p className="onboarding-description">
                                Selecciona tu preferencia de apariencia.
                                Puedes cambiarla en cualquier momento desde Ajustes.
                            </p>
                            <div className="theme-selector">
                                <button
                                    className="theme-option light"
                                    onClick={() => setTheme('light')}
                                >
                                    <div className="theme-preview" />
                                    <span>Claro</span>
                                </button>
                                <button
                                    className="theme-option dark"
                                    onClick={() => setTheme('dark')}
                                >
                                    <div className="theme-preview" />
                                    <span>Oscuro</span>
                                </button>
                                <button
                                    className="theme-option system"
                                    onClick={() => setTheme('system')}
                                >
                                    <div className="theme-preview" />
                                    <span>Sistema</span>
                                </button>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-primary btn-lg" onClick={handleComplete}>
                                ¡Listo!
                            </button>
                        </div>
                    </>
                )}
            </div>

            <style jsx>{`
        .onboarding-modal {
          max-width: 480px;
          text-align: center;
        }

        .onboarding-content {
          padding: var(--space-8);
        }

        .onboarding-icon {
          margin-bottom: var(--space-6);
        }

        .onboarding-description {
          color: var(--color-text-secondary);
          margin-top: var(--space-4);
          line-height: var(--line-height-relaxed);
        }

        .theme-selector {
          display: flex;
          gap: var(--space-4);
          justify-content: center;
          margin-top: var(--space-6);
        }

        .theme-option {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-3);
          border: 2px solid var(--color-border);
          border-radius: var(--radius-lg);
          background: transparent;
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .theme-option:hover {
          border-color: var(--color-accent);
        }

        .theme-preview {
          width: 60px;
          height: 40px;
          border-radius: var(--radius-md);
        }

        .theme-option.light .theme-preview {
          background: linear-gradient(135deg, #fff 50%, #f5f5f7 50%);
          border: 1px solid #e0e0e0;
        }

        .theme-option.dark .theme-preview {
          background: linear-gradient(135deg, #1c1c1e 50%, #000 50%);
        }

        .theme-option.system .theme-preview {
          background: linear-gradient(135deg, #fff 25%, #1c1c1e 25%, #1c1c1e 50%, #f5f5f7 50%, #f5f5f7 75%, #000 75%);
        }

        .theme-option span {
          font-size: var(--text-sm);
          color: var(--color-text-secondary);
        }
      `}</style>
        </div>
    );
}
