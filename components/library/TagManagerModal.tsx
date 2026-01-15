import { useState, useEffect } from 'react';
import { Tag, addTag, updateTag, deleteTag, getAllTags, getAllBooks, updateBook, Book } from '@/lib/db';
import { useLibraryStore } from '@/stores/appStore';
import { v4 as uuidv4 } from 'uuid';

interface TagManagerModalProps {
    onClose: () => void;
}

export function TagManagerModal({ onClose }: TagManagerModalProps) {
    const { tags, setTags, addTag: addTagStore, updateTag: updateTagStore, removeTag: removeTagStore } = useLibraryStore();
    const [newTagName, setNewTagName] = useState('');
    const [newTagColor, setNewTagColor] = useState<string>('#3b82f6');
    const [editingTagId, setEditingTagId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editColor, setEditColor] = useState<string>('#3b82f6');

    const PRESET_COLORS = [
        '#3b82f6', // Blue
        '#ef4444', // Red
        '#10b981', // Green
        '#f59e0b', // Yellow
        '#8b5cf6', // Purple
        '#ec4899', // Pink
        '#6366f1', // Indigo
        '#64748b', // Slate
    ];

    // Initial load if store is empty (or just refresh)
    useEffect(() => {
        getAllTags().then(fetchedTags => {
            setTags(fetchedTags);
        });
    }, [setTags]);

    const handleCreateTag = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = newTagName.trim();
        if (!trimmed) return;

        if (tags.some(t => t.name.toLowerCase() === trimmed.toLowerCase())) {
            alert('Ya existe una etiqueta con ese nombre.');
            return;
        }

        const newTag: Tag = {
            id: uuidv4(),
            name: trimmed,
            color: newTagColor,
            createdAt: new Date(),
        };

        try {
            await addTag(newTag);
            addTagStore(newTag);
            setNewTagName('');
            setNewTagColor(PRESET_COLORS[0]);
        } catch (error) {
            console.error('Failed to create tag', error);
        }
    };

    const handleStartEdit = (tag: Tag) => {
        setEditingTagId(tag.id);
        setEditName(tag.name);
        setEditColor(tag.color || PRESET_COLORS[0]);
    };

    const handleCancelEdit = () => {
        setEditingTagId(null);
        setEditName('');
    };

    const handleSaveEdit = async () => {
        if (!editingTagId) return;
        const tag = tags.find(t => t.id === editingTagId);
        if (!tag) return;

        const trimmed = editName.trim();
        if (!trimmed) return;

        if (trimmed !== tag.name && tags.some(t => t.id !== tag.id && t.name.toLowerCase() === trimmed.toLowerCase())) {
            alert('Ya existe una etiqueta con ese nombre.');
            return;
        }

        try {
            // 1. Update Tag in DB
            await updateTag(tag.id, { name: trimmed, color: editColor });

            // 2. Update all books that had the old tag name
            if (tag.name !== trimmed) {
                const books = await getAllBooks();
                const startName = tag.name;

                for (const book of books) {
                    if (book.metadata.tags?.includes(startName)) {
                        const newTags = book.metadata.tags.map(t => t === startName ? trimmed : t);
                        await updateBook(book.id, { metadata: { ...book.metadata, tags: newTags } });
                    }
                }
            }

            // 3. Update Store Tag
            updateTagStore(tag.id, { name: trimmed, color: editColor });

            handleCancelEdit();
        } catch (error) {
            console.error('Failed to update tag', error);
        }
    };

    const handleDeleteTag = async (id: string, name: string) => {
        if (!confirm(`¿Estás seguro de eliminar la etiqueta "${name}"? Esto no la eliminará de los libros, solo de la lista de gestión.`)) {
            return;
        }

        try {
            await deleteTag(id);

            // Remove from books
            const books = await getAllBooks();
            for (const book of books) {
                if (book.metadata.tags?.includes(name)) {
                    const newTags = book.metadata.tags.filter(t => t !== name);
                    await updateBook(book.id, { metadata: { ...book.metadata, tags: newTags } });
                }
            }

            removeTagStore(id);
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-[var(--color-bg-primary)] rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]">
                <div className="p-4 border-b border-[var(--color-divider)] flex justify-between items-center">
                    <h2 className="text-lg font-bold">Gestión de Etiquetas</h2>
                    <button onClick={onClose} className="p-2 hover:bg-[var(--color-bg-secondary)] rounded-full">
                        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>

                <div className="p-4 border-b border-[var(--color-divider)]">
                    <form onSubmit={handleCreateTag} className="flex flex-col gap-3">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newTagName}
                                onChange={e => setNewTagName(e.target.value)}
                                placeholder="Nueva etiqueta..."
                                className="flex-1 input"
                            />
                            <button type="submit" className="btn btn-primary" disabled={!newTagName.trim()}>
                                Crear
                            </button>
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                            {PRESET_COLORS.map(color => (
                                <button
                                    key={color}
                                    type="button"
                                    onClick={() => setNewTagColor(color)}
                                    className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${newTagColor === color ? 'border-white scale-110' : 'border-transparent opacity-80'}`}
                                    style={{ backgroundColor: color }}
                                />
                            ))}
                        </div>
                    </form>
                </div>

                <div className="overflow-y-auto p-2 flex-1 scrollbar-thin">
                    {tags.length === 0 ? (
                        <div className="text-center p-8 text-[var(--color-text-tertiary)]">
                            No hay etiquetas creadas.
                        </div>
                    ) : (
                        <div className="flex flex-col gap-1">
                            {tags.map(tag => (
                                <div key={tag.id} className="flex items-center justify-between p-2 hover:bg-[var(--color-bg-secondary)] rounded-md group">
                                    {editingTagId === tag.id ? (
                                        <div className="flex flex-col gap-2 flex-1 mr-2 p-2 bg-[var(--color-bg-tertiary)] rounded-md">
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={editName}
                                                    onChange={e => setEditName(e.target.value)}
                                                    className="flex-1 input text-sm py-1 h-8"
                                                    autoFocus
                                                />
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <div className="flex gap-1.5">
                                                    {PRESET_COLORS.map(color => (
                                                        <button
                                                            key={color}
                                                            type="button"
                                                            onClick={() => setEditColor(color)}
                                                            className={`w-4 h-4 rounded-full border-2 ${editColor === color ? 'border-white' : 'border-transparent opacity-60'}`}
                                                            style={{ backgroundColor: color }}
                                                        />
                                                    ))}
                                                </div>
                                                <div className="flex gap-1">
                                                    <button onClick={handleSaveEdit} className="btn btn-sm btn-primary py-0 h-6 text-xs">Ok</button>
                                                    <button onClick={handleCancelEdit} className="btn btn-sm btn-ghost py-0 h-6 text-xs">X</button>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex items-center gap-3">
                                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color || 'var(--color-accent)' }}></div>
                                                <span className="font-medium">{tag.name}</span>
                                            </div>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => handleStartEdit(tag)} className="p-1.5 hover:bg-[var(--color-bg-tertiary)] rounded text-[var(--color-text-secondary)]">
                                                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                                </button>
                                                <button onClick={() => handleDeleteTag(tag.id, tag.name)} className="p-1.5 hover:bg-[var(--color-red-500)] hover:text-white rounded text-[var(--color-text-secondary)]">
                                                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
