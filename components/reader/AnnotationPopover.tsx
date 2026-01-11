'use client';

import { useState } from 'react';
import { Annotation } from '@/lib/db';

interface AnnotationPopoverProps {
    position: { x: number; y: number };
    onHighlight: (color: Annotation['color'], note?: string) => void;
    onClose: () => void;
}

const colors: { value: Annotation['color']; label: string; hex: string }[] = [
    { value: 'yellow', label: 'Amarillo', hex: '#ffeb3b' },
    { value: 'green', label: 'Verde', hex: '#4caf50' },
    { value: 'blue', label: 'Azul', hex: '#2196f3' },
    { value: 'pink', label: 'Rosa', hex: '#e91e63' },
    { value: 'orange', label: 'Naranja', hex: '#ff9800' },
];

export function AnnotationPopover({ position, onHighlight, onClose }: AnnotationPopoverProps) {
    const [showNote, setShowNote] = useState(false);
    const [note, setNote] = useState('');
    const [selectedColor, setSelectedColor] = useState<Annotation['color']>('yellow');

    const handleHighlight = (color: Annotation['color']) => {
        if (showNote) {
            onHighlight(color, note.trim() || undefined);
        } else {
            onHighlight(color);
        }
    };

    return (
        <>
            <div
                className="annotation-popover glass animate-slide-up"
                style={{
                    left: `${position.x}px`,
                    top: `${position.y - 10}px`,
                }}
            >
                {!showNote ? (
                    <>
                        <div className="color-buttons">
                            {colors.map((color) => (
                                <button
                                    key={color.value}
                                    className="color-btn"
                                    style={{ backgroundColor: color.hex }}
                                    onClick={() => handleHighlight(color.value)}
                                    title={color.label}
                                />
                            ))}
                        </div>
                        <div className="popover-divider" />
                        <button className="action-btn" onClick={() => setShowNote(true)}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                            Añadir nota
                        </button>
                    </>
                ) : (
                    <div className="note-form">
                        <div className="color-buttons small">
                            {colors.map((color) => (
                                <button
                                    key={color.value}
                                    className={`color-btn ${selectedColor === color.value ? 'active' : ''}`}
                                    style={{ backgroundColor: color.hex }}
                                    onClick={() => setSelectedColor(color.value)}
                                    title={color.label}
                                />
                            ))}
                        </div>
                        <textarea
                            className="note-input"
                            placeholder="Escribe tu nota..."
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            autoFocus
                            rows={3}
                        />
                        <div className="note-actions">
                            <button className="btn btn-ghost" onClick={() => setShowNote(false)}>
                                Cancelar
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={() => handleHighlight(selectedColor)}
                            >
                                Guardar
                            </button>
                        </div>
                    </div>
                )}
            </div>
            <div className="popover-backdrop" onClick={onClose} />

            <style jsx>{`
        .annotation-popover {
          position: absolute;
          transform: translateX(-50%) translateY(-100%);
          padding: var(--space-2);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-lg);
          z-index: var(--z-tooltip);
          min-width: 200px;
        }

        .color-buttons {
          display: flex;
          gap: var(--space-2);
          padding: var(--space-1);
        }

        .color-buttons.small {
          margin-bottom: var(--space-2);
        }

        .color-btn {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: 2px solid transparent;
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .color-btn:hover {
          transform: scale(1.15);
        }

        .color-btn.active {
          border-color: var(--color-text-primary);
          transform: scale(1.15);
        }

        .popover-divider {
          height: 1px;
          background: var(--color-border);
          margin: var(--space-2) 0;
        }

        .action-btn {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          width: 100%;
          padding: var(--space-2) var(--space-3);
          font-size: var(--text-sm);
          color: var(--color-text-secondary);
          background: transparent;
          border: none;
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .action-btn:hover {
          background: var(--color-accent-subtle);
          color: var(--color-accent);
        }

        .note-form {
          padding: var(--space-2);
        }

        .note-input {
          width: 100%;
          padding: var(--space-2);
          font-size: var(--text-sm);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          background: var(--color-bg-secondary);
          color: var(--color-text-primary);
          resize: none;
          margin-bottom: var(--space-2);
        }

        .note-input:focus {
          outline: none;
          border-color: var(--color-accent);
        }

        .note-actions {
          display: flex;
          justify-content: flex-end;
          gap: var(--space-2);
        }

        .popover-backdrop {
          position: fixed;
          inset: 0;
          z-index: calc(var(--z-tooltip) - 1);
        }
      `}</style>
        </>
    );
}
