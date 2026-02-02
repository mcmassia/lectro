'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/stores/appStore';
import { getReadingGoals, updateReadingGoals, ReadingGoals } from '@/lib/db';
import { Clock, BookOpen, X, Check } from 'lucide-react';

interface GoalEditorProps {
    isOpen: boolean;
    onClose: () => void;
}

export function GoalEditor({ isOpen, onClose }: GoalEditorProps) {
    const { currentUser } = useAppStore();
    const [dailyTimeGoal, setDailyTimeGoal] = useState(15);
    const [yearlyBooksGoal, setYearlyBooksGoal] = useState(12);
    const [isSaving, setIsSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [originalGoals, setOriginalGoals] = useState<ReadingGoals | null>(null);

    useEffect(() => {
        async function loadGoals() {
            if (!currentUser) return;
            const goals = await getReadingGoals(currentUser.id);
            setDailyTimeGoal(goals.dailyTimeGoalMinutes);
            setYearlyBooksGoal(goals.yearlyBooksGoal);
            setOriginalGoals(goals);
        }

        if (isOpen) {
            loadGoals();
            setHasChanges(false);
        }
    }, [currentUser, isOpen]);

    useEffect(() => {
        if (originalGoals) {
            setHasChanges(
                dailyTimeGoal !== originalGoals.dailyTimeGoalMinutes ||
                yearlyBooksGoal !== originalGoals.yearlyBooksGoal
            );
        }
    }, [dailyTimeGoal, yearlyBooksGoal, originalGoals]);

    const handleSave = async () => {
        if (!currentUser || !hasChanges) return;

        setIsSaving(true);
        try {
            await updateReadingGoals(currentUser.id, {
                dailyTimeGoalMinutes: dailyTimeGoal,
                yearlyBooksGoal: yearlyBooksGoal,
            });
            onClose();
        } catch (error) {
            console.error('Error saving goals:', error);
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    const formatTimeGoal = (minutes: number) => {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
        if (hours > 0) return `${hours} hora${hours > 1 ? 's' : ''}`;
        return `${mins} minutos`;
    };

    return (
        <div className="goal-editor-overlay" onClick={onClose}>
            <div className="goal-editor" onClick={e => e.stopPropagation()}>
                <div className="editor-header">
                    <h2>Configurar Metas</h2>
                    <button className="close-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="editor-content">
                    {/* Daily Time Goal */}
                    <div className="goal-section">
                        <div className="goal-header">
                            <div className="goal-icon time">
                                <Clock size={20} />
                            </div>
                            <div className="goal-info">
                                <h3>Meta diaria de tiempo</h3>
                                <p>Cuánto tiempo quieres leer cada día</p>
                            </div>
                        </div>

                        <div className="goal-control">
                            <input
                                type="range"
                                min="5"
                                max="120"
                                step="5"
                                value={dailyTimeGoal}
                                onChange={e => setDailyTimeGoal(Number(e.target.value))}
                                className="goal-slider"
                            />
                            <div className="goal-value">
                                <span className="value-number">{dailyTimeGoal}</span>
                                <span className="value-unit">min</span>
                            </div>
                        </div>
                        <p className="goal-description">{formatTimeGoal(dailyTimeGoal)} al día</p>
                    </div>

                    {/* Yearly Books Goal */}
                    <div className="goal-section">
                        <div className="goal-header">
                            <div className="goal-icon books">
                                <BookOpen size={20} />
                            </div>
                            <div className="goal-info">
                                <h3>Meta anual de libros</h3>
                                <p>Cuántos libros quieres terminar este año</p>
                            </div>
                        </div>

                        <div className="goal-control">
                            <input
                                type="range"
                                min="1"
                                max="52"
                                step="1"
                                value={yearlyBooksGoal}
                                onChange={e => setYearlyBooksGoal(Number(e.target.value))}
                                className="goal-slider books"
                            />
                            <div className="goal-value">
                                <span className="value-number">{yearlyBooksGoal}</span>
                                <span className="value-unit">libros</span>
                            </div>
                        </div>
                        <p className="goal-description">
                            {yearlyBooksGoal === 52 ? 'Un libro por semana' :
                                yearlyBooksGoal === 12 ? 'Un libro por mes' :
                                    `${yearlyBooksGoal} libros al año`}
                        </p>
                    </div>
                </div>

                <div className="editor-footer">
                    <button className="btn-cancel" onClick={onClose}>
                        Cancelar
                    </button>
                    <button
                        className={`btn-save ${hasChanges ? 'active' : ''}`}
                        onClick={handleSave}
                        disabled={!hasChanges || isSaving}
                    >
                        {isSaving ? 'Guardando...' : (
                            <>
                                <Check size={16} />
                                Guardar
                            </>
                        )}
                    </button>
                </div>

                <style jsx>{`
          .goal-editor-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(4px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            padding: var(--space-4);
            animation: fadeIn 0.2s ease-out;
          }

          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }

          .goal-editor {
            background: var(--color-bg-primary);
            border-radius: var(--radius-xl);
            width: 100%;
            max-width: 420px;
            max-height: 90vh;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            animation: slideUp 0.3s ease-out;
          }

          @keyframes slideUp {
            from { 
              opacity: 0;
              transform: translateY(20px);
            }
            to { 
              opacity: 1;
              transform: translateY(0);
            }
          }

          .editor-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: var(--space-5);
            border-bottom: 1px solid var(--color-border);
          }

          .editor-header h2 {
            font-size: var(--text-lg);
            font-weight: 600;
            color: var(--color-text-primary);
            margin: 0;
          }

          .close-btn {
            background: none;
            border: none;
            color: var(--color-text-secondary);
            cursor: pointer;
            padding: var(--space-2);
            border-radius: var(--radius-md);
            transition: all 0.2s;
          }

          .close-btn:hover {
            background: var(--color-bg-tertiary);
            color: var(--color-text-primary);
          }

          .editor-content {
            padding: var(--space-5);
            display: flex;
            flex-direction: column;
            gap: var(--space-6);
            overflow-y: auto;
          }

          .goal-section {
            display: flex;
            flex-direction: column;
            gap: var(--space-4);
          }

          .goal-header {
            display: flex;
            align-items: flex-start;
            gap: var(--space-3);
          }

          .goal-icon {
            width: 44px;
            height: 44px;
            border-radius: var(--radius-lg);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            flex-shrink: 0;
          }

          .goal-icon.time {
            background: linear-gradient(135deg, #3b82f6, #6366f1);
          }

          .goal-icon.books {
            background: linear-gradient(135deg, #10b981, #34d399);
          }

          .goal-info h3 {
            font-size: var(--text-base);
            font-weight: 600;
            color: var(--color-text-primary);
            margin: 0 0 4px 0;
          }

          .goal-info p {
            font-size: var(--text-sm);
            color: var(--color-text-secondary);
            margin: 0;
          }

          .goal-control {
            display: flex;
            align-items: center;
            gap: var(--space-4);
          }

          .goal-slider {
            flex: 1;
            height: 8px;
            border-radius: var(--radius-full);
            accent-color: #3b82f6;
            cursor: pointer;
          }

          .goal-slider.books {
            accent-color: #10b981;
          }

          .goal-value {
            display: flex;
            align-items: baseline;
            gap: var(--space-1);
            min-width: 80px;
            justify-content: flex-end;
          }

          .value-number {
            font-size: var(--text-2xl);
            font-weight: 700;
            color: var(--color-text-primary);
          }

          .value-unit {
            font-size: var(--text-sm);
            color: var(--color-text-tertiary);
          }

          .goal-description {
            font-size: var(--text-sm);
            color: var(--color-text-secondary);
            margin: 0;
            padding-left: calc(44px + var(--space-3));
          }

          .editor-footer {
            display: flex;
            gap: var(--space-3);
            padding: var(--space-5);
            border-top: 1px solid var(--color-border);
          }

          .btn-cancel, .btn-save {
            flex: 1;
            padding: var(--space-3);
            border-radius: var(--radius-lg);
            font-size: var(--text-base);
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: var(--space-2);
          }

          .btn-cancel {
            background: var(--color-bg-tertiary);
            border: 1px solid var(--color-border);
            color: var(--color-text-secondary);
          }

          .btn-cancel:hover {
            background: var(--color-bg-elevated);
            color: var(--color-text-primary);
          }

          .btn-save {
            background: var(--color-bg-tertiary);
            border: 1px solid var(--color-border);
            color: var(--color-text-tertiary);
          }

          .btn-save.active {
            background: var(--color-accent);
            border-color: var(--color-accent);
            color: white;
          }

          .btn-save.active:hover {
            filter: brightness(1.1);
          }

          .btn-save:disabled {
            opacity: 0.7;
            cursor: not-allowed;
          }
        `}</style>
            </div>
        </div>
    );
}
