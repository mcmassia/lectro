import { useState, useEffect } from 'react';
import { Book, Tag, getAllTags, updateBook } from '@/lib/db';
import { useLibraryStore } from '@/stores/appStore';

interface MassTagManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedBooks: Book[];
    onSuccess: () => void;
}

type TagState = 'checked' | 'unchecked' | 'indeterminate';

export function MassTagManagerModal({ isOpen, onClose, selectedBooks, onSuccess }: MassTagManagerModalProps) {
    const [availableTags, setAvailableTags] = useState<Tag[]>([]);
    const [tagStates, setTagStates] = useState<Record<string, TagState>>({});
    const [isLoading, setIsLoading] = useState(false);
    const { setBooks, books } = useLibraryStore();

    useEffect(() => {
        if (isOpen) {
            loadTags();
            calculateTagStates();
        }
    }, [isOpen, selectedBooks]);

    const loadTags = async () => {
        const tags = await getAllTags();
        setAvailableTags(tags.sort((a, b) => a.name.localeCompare(b.name)));
    };

    const calculateTagStates = () => {
        if (!selectedBooks.length) return;

        const states: Record<string, TagState> = {};

        // We need to check against available tags, but initially we might not have them loaded in state yet
        // so we can rely on what we fetch or just compute based on books first.
        // Actually, we need to iterate all KNOWN tags to determine their state for the selection.
        // But we can also just look at the tags present in the books.

        // Let's rely on availableTags once loaded.
        // But inside useEffect, we might not have them fresh if verify is async.
        // So let's compute purely from books first for ALL tags they have.

        const allTagsInSelection = new Set<string>();
        selectedBooks.forEach(b => b.metadata?.tags?.forEach(t => allTagsInSelection.add(t)));

        // For each tag present in at least one book:
        allTagsInSelection.forEach(tagName => {
            let presentCount = 0;
            selectedBooks.forEach(b => {
                if (b.metadata?.tags?.includes(tagName)) presentCount++;
            });

            if (presentCount === selectedBooks.length) {
                states[tagName] = 'checked';
            } else if (presentCount > 0) {
                states[tagName] = 'indeterminate';
            } else {
                states[tagName] = 'unchecked'; // Should not happen if we iterate present tags
            }
        });

        // Ensure all OTHER available tags are explicitly 'unchecked' if we want to show them?
        // We will map over 'availableTags' in render. If not in 'states', it's 'unchecked'.
        setTagStates(states);
    };

    const handleToggleTag = (tagName: string) => {
        const currentState = tagStates[tagName] || 'unchecked';
        let newState: TagState;

        if (currentState === 'checked') newState = 'unchecked';
        else if (currentState === 'unchecked') newState = 'checked';
        else newState = 'checked'; // Indeterminate -> Checked (Add to all)

        setTagStates(prev => ({ ...prev, [tagName]: newState }));
    };

    const handleSave = async () => {
        setIsLoading(true);
        try {
            // We need to apply changes to all selected books.
            // Iterate over all available tags (or at least those in tagStates).
            // But wait, the user might have clicked a tag that wasn't previously in any book.
            // So we iterate over 'availableTags' + any NEW tags? 
            // Currently we only support assigning EXISTING tags via this modal (as per availableTags).

            const updates = selectedBooks.map(async (book) => {
                let newTags = new Set(book.metadata.tags || []);

                availableTags.forEach(tag => {
                    const state = tagStates[tag.name] || 'unchecked';
                    if (state === 'checked') {
                        newTags.add(tag.name);
                    } else if (state === 'unchecked') {
                        // Only remove if we explicitly unchecked it?
                        // If it was 'checked' before (in DB) and now 'unchecked' (in UI), we remove it.
                        // The UI state represents the Desired State.
                        // 'unchecked' means "None of these books should have this tag".
                        // 'indeterminate' means "Leave as is"? 
                        // Wait.
                        // If I leave a tag as 'indeterminate', I shouldn't touch it.
                        // If I change it to 'checked', I add it to all.
                        // If I change it to 'unchecked', I remove it from all.

                        // BUT, 'unchecked' is the default for tags not in selection.
                        // If I have a tag "SciFi" that none of the books have, it is 'unchecked'.
                        // If I leave it 'unchecked', I shouldn't explicitly remove it (it's already not there).
                        // But if I have "Fiction" which ALL have, it comes in as 'checked'.
                        // If I click it to 'unchecked', I want to remove it.

                        // So:
                        // Checked -> Ensure present.
                        // Unchecked -> Ensure absent.
                        // Indeterminate -> Do nothing (preserve individual book state).

                        // This applies to ALL tags in availableTags.
                        newTags.delete(tag.name);
                    }
                });

                // Re-add checked ones
                availableTags.forEach(tag => {
                    const state = tagStates[tag.name];
                    if (state === 'checked') newTags.add(tag.name);
                    // If indeterminate, we already have the original state in `newTags` (from initial Set),
                    // BUT we deleted everything in the previous step?
                    // Logic correction:
                });

                // Let's refine logic.

                // Correct Logic:
                // Start with original tags.
                // Iterate all processed tags.
                // If state is 'checked': add tag.
                // If state is 'unchecked': remove tag.
                // If state is 'indeterminate': do nothing.

                // But `tagStates` only has entries for things we touched or initially calculated?
                // Initially calculated included only tags PRESENTE in selection.
                // So tags NOT present are undefined (effectively unchecked).
                // If I click on a NEW tag, it becomes 'checked'.
                // If I leave it undefined, it stays undefined.

                // So:
                // unchecked -> remove.
                // checked -> add.
                // indeterminate -> no-op.
                // undefined -> no-op?
                // Wait. If a tag was present in ALL (so initial 'checked'), and I uncheck it -> 'unchecked'.
                // If a tag was present in NONE (initial undefined/'unchecked'), and I leave it -> 'unchecked'.
                // Should "unchecked" mean "remove"?
                // Yes if it was present.
                // If it wasn't present, "remove" is a no-op.
                // So "unchecked" is safely "remove".

                // So the logic is consistent:
                // checked: add
                // unchecked: remove
                // indeterminate: ignore

                // BUT what about `tagStates` initialization?
                // We initialized it based on presence.
                // Creating a simplified set of final tags:

                let finalTags = new Set(book.metadata.tags || []);

                availableTags.forEach(tag => {
                    const state = tagStates[tag.name];
                    if (state === 'checked') {
                        finalTags.add(tag.name);
                    } else if (state === 'unchecked') {
                        finalTags.delete(tag.name); // Safe even if not present
                    } else if (state === 'indeterminate') {
                        // Leave as is
                    } else {
                        // Undefined in tagStates.
                        // This means it wasn't in any book (so not initialized) AND user didn't touch it.
                        // It effectively is "unchecked". 
                        // Should we ensure removal?
                        // If it wasn't in any book, removing does nothing.
                        // So treating it as 'unchecked' is safe.
                        finalTags.delete(tag.name);
                    }
                });

                return updateBook(book.id, {
                    metadata: {
                        ...book.metadata,
                        tags: Array.from(finalTags)
                    }
                });
            });

            await Promise.all(updates);
            onSuccess();
            onClose();
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3 className="heading-3">Gestionar Etiquetas ({selectedBooks.length})</h3>
                    <button className="close-btn" onClick={onClose}>✕</button>
                </div>

                <div className="modal-body">
                    <div className="tags-grid">
                        {availableTags.map(tag => {
                            const state = tagStates[tag.name] || 'unchecked';
                            return (
                                <button
                                    key={tag.id}
                                    className={`tag-toggle ${state}`}
                                    onClick={() => handleToggleTag(tag.name)}
                                >
                                    <div className="checkbox">
                                        {state === 'checked' && <CheckIcon />}
                                        {state === 'indeterminate' && <MinusIcon />}
                                    </div>
                                    <span className="tag-name">{tag.name}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose} disabled={isLoading}>Cancelar</button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={isLoading}>
                        {isLoading ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                </div>
            </div>

            <style jsx>{`
                .modal-overlay {
                    position: fixed;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(0,0,0,0.8);
                    z-index: 1000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    animation: fadeIn 0.2s;
                }
                
                .modal-content {
                    background: var(--color-bg-secondary);
                    border-radius: var(--radius-lg);
                    width: 100%;
                    max-width: 500px;
                    border: 1px solid var(--color-border);
                    display: flex;
                    flex-direction: column;
                    max-height: 80vh;
                }

                .modal-header {
                    padding: var(--space-4) var(--space-6);
                    border-bottom: 1px solid var(--color-border);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .close-btn {
                    background: none;
                    border: none;
                    color: var(--color-text-secondary);
                    font-size: 1.5rem;
                    cursor: pointer;
                    padding: 0;
                    line-height: 1;
                }

                .modal-body {
                    padding: var(--space-6);
                    overflow-y: auto;
                }

                .tags-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
                    gap: var(--space-3);
                }

                .tag-toggle {
                    display: flex;
                    align-items: center;
                    gap: var(--space-3);
                    background: var(--color-bg-tertiary);
                    border: 1px solid transparent;
                    padding: var(--space-3);
                    border-radius: var(--radius-md);
                    cursor: pointer;
                    color: var(--color-text-primary);
                    transition: all 0.2s;
                    text-align: left;
                }

                .tag-toggle:hover {
                    background: var(--color-bg-elevated);
                }

                .tag-toggle.checked {
                    background: rgba(var(--color-accent-rgb), 0.1);
                    border-color: var(--color-accent);
                }

                .checkbox {
                    width: 20px;
                    height: 20px;
                    border-radius: 4px;
                    border: 2px solid var(--color-text-tertiary);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    flex-shrink: 0;
                }

                .tag-toggle.checked .checkbox {
                    background: var(--color-accent);
                    border-color: var(--color-accent);
                }
                
                .tag-toggle.indeterminate .checkbox {
                    background: var(--color-text-tertiary);
                    border-color: var(--color-text-tertiary);
                }

                .tag-name {
                    font-size: var(--text-sm);
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .modal-footer {
                    padding: var(--space-4) var(--space-6);
                    border-top: 1px solid var(--color-border);
                    display: flex;
                    justify-content: flex-end;
                    gap: var(--space-3);
                }

                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
            `}</style>
        </div>
    );
}

const CheckIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" width="14" height="14">
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

const MinusIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" width="14" height="14">
        <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
);
