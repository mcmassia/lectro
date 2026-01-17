'use client';

import { useState } from 'react';
import { Annotation } from '@/lib/db';
import { clusterNotes, NoteCluster } from '@/lib/ai/notes_ai';
import { Sparkles, Brain, Link as LinkIcon, Activity, Zap, Layers, ArrowRight } from 'lucide-react';

interface InsightsPanelProps {
    notes: Annotation[];
}

export function InsightsPanel({ notes }: InsightsPanelProps) {
    const [clusters, setClusters] = useState<NoteCluster[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);

    const handleGenerateInsights = async () => {
        setIsGenerating(true);
        try {
            const notesForAi = notes.slice(0, 20).map(n => ({
                id: n.id,
                text: n.text,
                note: n.note
            }));
            const result = await clusterNotes(notesForAi);
            setClusters(result);
        } catch (err) {
            console.error(err);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <aside className="w-[320px] bg-[var(--color-bg-secondary)] border-l border-[var(--color-border)] flex flex-col h-full overflow-y-auto custom-scrollbar p-8 hidden xl:block shadow-xl z-10">

            {/* Header / Title */}
            <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-2 text-[var(--color-accent)]">
                    <Sparkles size={18} fill="currentColor" className="opacity-20" />
                    <span className="font-bold text-sm tracking-wide">AI Context</span>
                </div>
                <div className="px-2 py-0.5 rounded-full bg-[var(--color-bg-tertiary)] border border-[var(--color-border)]">
                    <span className="text-[10px] font-medium text-[var(--color-text-tertiary)]">Beta</span>
                </div>
            </div>

            {/* AI Insight Stream - "Chat/Stream Style" */}
            <div className="space-y-8 mb-10">

                {/* Active Insight */}
                <div className="relative pl-4 border-l-2 border-[var(--color-accent)] animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <p className="text-sm text-[var(--color-text-primary)] leading-relaxed mb-3">
                        He detectado una conexión fuerte entre tus notas de <span className="font-semibold">Sapiens</span> y los conceptos de <span className="font-semibold">Psicología Evolutiva</span>.
                    </p>
                    <button
                        onClick={handleGenerateInsights}
                        disabled={isGenerating}
                        className="text-xs font-semibold text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors flex items-center gap-1"
                    >
                        {isGenerating ? 'Profundizando...' : 'Ver análisis completo'} <ArrowRight size={12} />
                    </button>
                </div>

                {/* Concept Pills - "Floating" */}
                <div>
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-tertiary)] mb-3 opacity-70">Conceptos Clave</h3>
                    <div className="flex flex-wrap gap-2">
                        {clusters.length > 0 ? clusters.map((c, i) => (
                            <span key={i} className="px-2.5 py-1 rounded-full bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[10px] text-[var(--color-text-secondary)] font-medium shadow-sm">
                                {c.topic}
                            </span>
                        )) : (
                            <>
                                <span className="px-2.5 py-1 rounded-full bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[10px] text-[var(--color-text-secondary)] font-medium shadow-sm">Sesgos Cognitivos</span>
                                <span className="px-2.5 py-1 rounded-full bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[10px] text-[var(--color-text-secondary)] font-medium shadow-sm">Historia</span>
                                <span className="px-2.5 py-1 rounded-full bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[10px] text-[var(--color-text-secondary)] font-medium shadow-sm">Evolución</span>
                            </>
                        )}
                    </div>
                </div>

            </div>

            {/* Related Snippets - Minimal List */}
            <div className="mb-10">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-tertiary)]">Referencias Cruzadas</h3>
                    <span className="text-[10px] text-[var(--color-text-tertiary)] bg-[var(--color-bg-tertiary)] px-1.5 py-0.5 rounded">3</span>
                </div>

                <div className="space-y-5">
                    <div className="group cursor-pointer">
                        <p className="text-xs text-[var(--color-text-secondary)] mb-1 line-clamp-2 group-hover:text-[var(--color-text-primary)] transition-colors">
                            "La percepción es la clave para la acción..."
                        </p>
                        <div className="flex items-center gap-1.5 opacity-60">
                            <div className="w-1 h-1 rounded-full bg-[var(--color-text-tertiary)]"></div>
                            <span className="text-[10px] text-[var(--color-text-tertiary)]">El Obstáculo es el Camino</span>
                        </div>
                    </div>

                    <div className="w-full h-[1px] bg-[var(--color-border)]"></div>

                    <div className="group cursor-pointer">
                        <p className="text-xs text-[var(--color-text-secondary)] mb-1 line-clamp-2 group-hover:text-[var(--color-text-primary)] transition-colors">
                            "Nuestra vida es lo que nuestros pensamientos crean."
                        </p>
                        <div className="flex items-center gap-1.5 opacity-60">
                            <div className="w-1 h-1 rounded-full bg-[var(--color-text-tertiary)]"></div>
                            <span className="text-[10px] text-[var(--color-text-tertiary)]">Meditaciones</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Sync Status - Bottom Minimal */}
            <div className="mt-auto">
                <div className="p-3 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)]">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase">Sincronización</span>
                        <div className="h-1.5 w-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]"></div>
                    </div>
                    <div className="flex items-center gap-3 opacity-80">
                        <div className="w-6 h-6 rounded bg-[var(--color-bg-tertiary)] flex items-center justify-center">
                            <LinkIcon size={12} className="text-[var(--color-text-secondary)]" />
                        </div>
                        <div className="flex-1">
                            <div className="h-1 w-full bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
                                <div className="h-full w-[80%] bg-[var(--color-accent)]"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

        </aside>
    );
}
