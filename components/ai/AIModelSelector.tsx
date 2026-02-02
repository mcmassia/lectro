'use client';

import { ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

export interface AIModel {
    id: string;
    name: string;
    description: string;
}

export const AI_MODELS: AIModel[] = [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Rápido y eficiente' },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Versión anterior' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Más preciso' },
];

interface AIModelSelectorProps {
    selectedModel: string;
    onModelChange: (modelId: string) => void;
    compact?: boolean;
}

export function AIModelSelector({ selectedModel, onModelChange, compact = false }: AIModelSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    const currentModel = AI_MODELS.find(m => m.id === selectedModel) || AI_MODELS[0];

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-colors bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-accent)]"
            >
                {compact ? currentModel.name.split(' ').slice(-2).join(' ') : currentModel.name}
                <ChevronDown size={12} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute bottom-full left-0 mb-2 w-52 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-xl shadow-xl z-50 overflow-hidden">
                    <div className="p-2">
                        <span className="block px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                            Modelo de IA
                        </span>
                        {AI_MODELS.map(model => (
                            <button
                                key={model.id}
                                onClick={() => {
                                    onModelChange(model.id);
                                    setIsOpen(false);
                                }}
                                className={`w-full text-left px-2 py-2 rounded-lg text-xs transition-colors ${selectedModel === model.id
                                        ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                                        : 'hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]'
                                    }`}
                            >
                                <span className="font-medium">{model.name}</span>
                                <span className="block text-[10px] text-[var(--color-text-tertiary)] mt-0.5">
                                    {model.description}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
