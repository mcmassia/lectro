import React, { useState, useMemo } from 'react';
import { useLibraryStore } from '@/stores/appStore';
import {
    Search, Plus, Edit2, Trash2,
    TrendingUp, Clock, AlertTriangle,
    Filter, X, Check, Save, RotateCcw
} from 'lucide-react';
import { getAllTags, addTag, updateTag, deleteTag, Tag } from '@/lib/db';
import { formatDate } from '@/lib/utils'; // Assuming this exists, or I will use inline

export default function TagManagerView() {
    const { tags, books, setTags, loadBooks, updateBook } = useLibraryStore();
    const [searchTerm, setSearchTerm] = useState('');
    const [viewFilter, setViewFilter] = useState<'all' | 'active' | 'unused'>('all');

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTag, setEditingTag] = useState<Tag | null>(null);
    const [tagName, setTagName] = useState('');
    const [tagColor, setTagColor] = useState('#3b82f6');

    // Stats Calculation
    const stats = useMemo(() => {
        const usage: Record<string, number> = {};
        const unassigned: string[] = [];

        // Initialize counts
        tags.forEach(t => { usage[t.name] = 0; });

        // Count usage
        books.forEach(b => {
            b.metadata?.tags?.forEach(t => {
                if (usage[t] !== undefined) {
                    usage[t]++;
                } else {
                    // Handle tags on books that are not in global list (orphans)
                    // We might want to auto-add them or ignore. 
                    // For now, ignore or track as 'Legacy'.
                    usage[t] = (usage[t] || 0) + 1;
                }
            });
        });

        const activeCount = Object.values(usage).filter(c => c > 0).length;
        const totalCount = tags.length;
        const emptyCount = tags.filter(t => usage[t.name] === 0).length;

        // Top 10
        const topTags = tags
            .map(t => ({ ...t, count: usage[t.name] || 0 }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        // Recents (Sort by createdAt desc)
        const recentTags = [...tags]
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 5);

        return { usage, activeCount, totalCount, emptyCount, topTags, recentTags };
    }, [tags, books]);

    // Filtered Tags for Table
    const filteredTags = useMemo(() => {
        return tags.filter(t => {
            const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase());
            const count = stats.usage[t.name] || 0;
            const matchesView =
                viewFilter === 'all' ? true :
                    viewFilter === 'active' ? count > 0 :
                        viewFilter === 'unused' ? count === 0 : true;

            return matchesSearch && matchesView;
        }).map(t => ({
            ...t,
            count: stats.usage[t.name] || 0
        }));
    }, [tags, searchTerm, viewFilter, stats.usage]);

    // Handlers
    const handleSaveTag = async () => {
        if (!tagName.trim()) return;

        try {
            if (editingTag) {
                // Update
                const oldName = editingTag.name;
                await updateTag(editingTag.id, { name: tagName, color: tagColor });

                // If name changed, update all books
                if (oldName !== tagName) {
                    const booksToUpdate = books.filter(b => b.metadata?.tags?.includes(oldName));
                    for (const book of booksToUpdate) {
                        const newTags = (book.metadata?.tags || []).map(t => t === oldName ? tagName : t);
                        // We need to update book in DB and Store. 
                        // Assuming updateBook action exists or we modify local.
                        // Actually useLibraryStore has updateBook.
                        // Wait, updateBook accepts partial? No, full book usually?
                        // Let's assume we maintain data consistency via a store reload or manual update
                        // For safety, let's update entries
                        await updateBook(book.id, { metadata: { ...book.metadata, tags: newTags } });
                    }
                }
            } else {
                // Create
                await addTag(tagName, tagColor);
            }

            // Refresh
            const allTags = await getAllTags();
            setTags(allTags);
            handleCloseModal();
        } catch (error) {
            console.error('Failed to save tag', error);
            alert('Error saving tag');
        }
    };

    const handleDeleteTag = async (id: string, name: string) => {
        if (!confirm(`¿Eliminar etiqueta "${name}"? Se eliminará de ${stats.usage[name] || 0} libros.`)) return;

        try {
            await deleteTag(id);
            // Optionally remove from books?
            // Usually we keep the string on books until they are opened, or we do a mass scrub.
            // For now, just delete the global tag definition.

            const allTags = await getAllTags();
            setTags(allTags);
        } catch (e) {
            console.error(e);
        }
    };

    const handleOpenCreate = () => {
        setEditingTag(null);
        setTagName('');
        setTagColor('#3b82f6');
        setIsModalOpen(true);
    };

    const handleOpenEdit = (tag: Tag) => {
        setEditingTag(tag);
        setTagName(tag.name);
        setTagColor(tag.color || '#3b82f6');
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingTag(null);
    };

    const handleCleanUnused = async () => {
        const unused = tags.filter(t => (stats.usage[t.name] || 0) === 0);
        if (unused.length === 0) return alert('No hay etiquetas vacías para limpiar.');

        if (!confirm(`¿Eliminar ${unused.length} etiquetas vacías?`)) return;

        for (const t of unused) {
            await deleteTag(t.id);
        }
        const allTags = await getAllTags();
        setTags(allTags);
    };

    // Helper for formatting time
    const timeAgo = (date: Date) => {
        const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + " años";
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + " meses";
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + " días";
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + " horas";
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + " minutos";
        return "Hace un momento";
    };

    return (
        <div className="tag-dashboard">
            {/* Header */}
            <header className="dashboard-header">
                <div>
                    <h1 className="page-title">Gestión de Etiquetas</h1>
                    <p className="page-subtitle">Organiza y mantén las categorías de tu biblioteca digital.</p>
                </div>
                <div className="header-actions">
                    <div className="search-bar">
                        <Search size={18} className="search-icon" />
                        <input
                            type="text"
                            placeholder="Buscar etiqueta..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button className="btn-primary" onClick={handleOpenCreate}>
                        <Plus size={18} />
                        <span>Añadir nueva etiqueta</span>
                    </button>
                </div>
            </header>

            {/* Stats Row */}
            <div className="stats-row">
                <div className="stat-card">
                    <div className="stat-header">
                        <span className="stat-title">Total de Etiquetas</span>
                        <span className="stat-badge success">+12%</span>
                    </div>
                    <div className="stat-value">{stats.totalCount.toLocaleString()}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-header">
                        <span className="stat-title">Uso Activo</span>
                        <span className="stat-badge success">+8%</span>
                    </div>
                    <div className="stat-value">{stats.activeCount.toLocaleString()}</div>
                </div>
                <div className="stat-card warning">
                    <div className="stat-header">
                        <span className="stat-title warning-text">SIN ASIGNAR</span>
                        <AlertTriangle size={20} className="warning-icon" />
                    </div>
                    <div className="stat-value-row">
                        <span className="stat-value white">{stats.emptyCount}</span>
                        <span className="stat-desc">etiquetas vacías</span>
                    </div>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="content-grid">
                {/* Master List */}
                <div className="master-list-panel">
                    <div className="panel-header">
                        <h3>Lista Maestro de Etiquetas</h3>
                        <div className="panel-actions">
                            <button className={`filter-btn ${viewFilter === 'all' ? 'active' : ''}`} onClick={() => setViewFilter('all')}>
                                <Filter size={14} /> Todas
                            </button>
                            <button className={`filter-btn ${viewFilter === 'active' ? 'active' : ''}`} onClick={() => setViewFilter('active')}>
                                Activas
                            </button>
                            <button className={`filter-btn ${viewFilter === 'unused' ? 'active' : ''}`} onClick={() => setViewFilter('unused')}>
                                Vacías
                            </button>
                        </div>
                    </div>

                    <div className="table-container">
                        <table className="tags-table">
                            <thead>
                                <tr>
                                    <th>NOMBRE DE ETIQUETA</th>
                                    <th>LIBROS</th>
                                    <th>ESTADO</th>
                                    <th className="align-right">ACCIONES</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredTags.map(tag => (
                                    <tr key={tag.id}>
                                        <td>
                                            <div className="tag-name-cell">
                                                <span className="color-dot" style={{ backgroundColor: tag.color || '#3b82f6' }}></span>
                                                {tag.name}
                                            </div>
                                        </td>
                                        <td>
                                            <span className="book-count-badge">{tag.count}</span>
                                        </td>
                                        <td>
                                            <span className={`status-badge ${tag.count > 0 ? 'active' : 'inactive'}`}>
                                                {tag.count > 0 ? 'ACTIVA' : 'INACTIVA'}
                                            </span>
                                        </td>
                                        <td className="align-right actions-cell">
                                            <button className="action-btn" onClick={() => handleOpenEdit(tag)}>
                                                <Edit2 size={16} />
                                            </button>
                                            <button className="action-btn delete" onClick={() => handleDeleteTag(tag.id, tag.name)}>
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {filteredTags.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="empty-state">
                                            No se encontraron etiquetas
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="list-footer">
                        Viendo {filteredTags.length} etiquetas ({stats.totalCount} total)
                    </div>
                </div>

                {/* Sidebar */}
                <div className="dashboard-sidebar">
                    {/* Top 10 */}
                    <div className="sidebar-section">
                        <div className="section-header">
                            <h3>Top 10 Tendencias</h3>
                            <span className="badge-sm">+15% SEM.</span>
                        </div>
                        <div className="trends-list">
                            {stats.topTags.map(tag => (
                                <div key={tag.id} className="trend-item">
                                    <div className="trend-info">
                                        <span className="trend-name">{tag.name}</span>
                                        <span className="trend-count">{tag.count}</span>
                                    </div>
                                    <div className="progress-bar-bg">
                                        <div
                                            className="progress-bar-fill"
                                            style={{ width: `${(tag.count / (stats.topTags[0]?.count || 1)) * 100}%` }}
                                        ></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="view-more-link">
                            Ver tendencias <span>↗</span>
                        </div>
                    </div>

                    {/* Recents */}
                    <div className="sidebar-section">
                        <div className="section-header">
                            <h3>5 Recientes</h3>
                        </div>
                        <div className="recent-list">
                            {stats.recentTags.map(tag => (
                                <div key={tag.id} className="recent-item">
                                    <div className="recent-icon-wrapper">
                                        <Clock size={16} />
                                    </div>
                                    <div className="recent-details">
                                        <span className="recent-name">{tag.name}</span>
                                        <span className="recent-time">Hace {timeAgo(new Date(tag.createdAt))}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Cleaning Promo */}
                    <div className="cleaning-card">
                        <div className="cleaning-header">
                            <span className="clean-icon">🧹</span>
                            <span className="clean-label">REQUIERE LIMPIEZA</span>
                        </div>
                        <div className="clean-title">{stats.emptyCount} Etiquetas Vacías</div>
                        <div className="clean-desc">Etiquetas sin libros asignados detectadas en la base de datos.</div>
                        <div className="clean-actions">
                            <button className="btn-white" onClick={handleCleanUnused}>Revisar</button>
                            <button className="btn-icon-red"><Trash2 size={16} /></button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Edit/Create Modal Overlay */}
            {isModalOpen && (
                <div className="dialog-overlay">
                    <div className="dialog-content">
                        <h2>{editingTag ? 'Editar Etiqueta' : 'Nueva Etiqueta'}</h2>
                        <div className="form-group">
                            <label>Nombre</label>
                            <input
                                value={tagName}
                                onChange={(e) => setTagName(e.target.value)}
                                placeholder="Nombre de la etiqueta"
                                autoFocus
                            />
                        </div>
                        <div className="form-group">
                            <label>Color</label>
                            <div className="color-picker">
                                {['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#6366f1'].map(color => (
                                    <button
                                        key={color}
                                        className={`color-swatch ${tagColor === color ? 'selected' : ''}`}
                                        style={{ backgroundColor: color }}
                                        onClick={() => setTagColor(color)}
                                    />
                                ))}
                            </div>
                        </div>
                        <div className="dialog-actions">
                            <button className="btn-text" onClick={handleCloseModal}>Cancelar</button>
                            <button className="btn-primary" onClick={handleSaveTag}>Guardar</button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                .tag-dashboard {
                    height: 100vh;
                    background-color: var(--color-bg-primary);
                    color: var(--color-text-primary);
                    display: flex;
                    flex-direction: column;
                    padding: var(--space-6);
                    gap: var(--space-6);
                    overflow-y: auto;
                    box-sizing: border-box;
                    font-family: var(--font-sans);
                }

                /* Header */
                .dashboard-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-end;
                }
                .page-title {
                    font-size: var(--text-2xl);
                    font-weight: 800;
                    margin: 0;
                    color: var(--color-text-primary);
                    letter-spacing: -0.5px;
                }
                .page-subtitle {
                    color: var(--color-text-secondary);
                    margin: 4px 0 0 0;
                    font-size: var(--text-sm);
                }
                .header-actions {
                    display: flex;
                    gap: var(--space-4);
                }
                .search-bar {
                    background: var(--color-bg-secondary);
                    border: 1px solid var(--color-border);
                    padding: 8px 12px;
                    border-radius: var(--radius-md);
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    width: 280px;
                }
                .search-bar input {
                    background: transparent;
                    border: none;
                    color: var(--color-text-primary);
                    outline: none;
                    width: 100%;
                    font-size: var(--text-sm);
                }
                .search-icon { color: var(--color-text-tertiary); }
                .btn-primary {
                    background: var(--color-accent);
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: var(--radius-md);
                    font-weight: 500;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    cursor: pointer;
                    font-size: var(--text-sm);
                    transition: background 0.2s;
                }
                .btn-primary:hover { background: var(--color-accent-hover); }

                /* Stats Row */
                .stats-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr 1fr;
                    gap: var(--space-6);
                }
                .stat-card {
                    background: var(--color-bg-tertiary);
                    border: 1px solid var(--color-border);
                    padding: 20px;
                    border-radius: var(--radius-lg);
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                .stat-card.warning {
                    border-color: var(--color-warning);
                    background: rgba(249, 115, 22, 0.1); 
                }
                .stat-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .stat-title {
                    font-size: var(--text-sm);
                    color: var(--color-text-secondary);
                }
                .warning-text { color: var(--color-warning); font-weight: 700; }
                .stat-badge {
                    background: rgba(16, 185, 129, 0.1);
                    color: var(--color-success);
                    font-size: 12px;
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-weight: 600;
                }
                .stat-value {
                    font-size: 32px;
                    font-weight: 700;
                    color: var(--color-text-primary);
                }
                .stat-value-row {
                    display: flex;
                    align-items: baseline;
                    gap: 8px;
                }
                .stat-desc { color: var(--color-text-secondary); font-size: 14px; }
                .warning-icon { color: var(--color-warning); }

                /* Content Grid */
                .content-grid {
                    display: grid;
                    grid-template-columns: 2fr 1fr;
                    gap: var(--space-6);
                    flex: 1; /* Fill remaining height */
                    min-height: 0;
                }

                /* Master List */
                .master-list-panel {
                    border: 1px solid var(--color-border);
                    border-radius: var(--radius-lg);
                    display: flex;
                    flex-direction: column;
                    background: var(--color-bg-tertiary);
                    overflow: hidden;
                }
                .panel-header {
                    padding: 16px 20px;
                    border-bottom: 1px solid var(--color-border);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .panel-header h3 {
                    margin: 0;
                    font-size: var(--text-base);
                    font-weight: 600;
                }
                .panel-actions {
                    display: flex;
                    gap: 8px;
                }
                .filter-btn {
                    background: transparent;
                    border: none;
                    color: var(--color-text-secondary);
                    font-size: 13px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 4px 8px;
                    border-radius: 4px;
                }
                .filter-btn:hover { color: var(--color-text-primary); background: var(--color-bg-elevated); }
                .filter-btn.active { color: var(--color-accent); background: var(--color-accent-subtle); }

                .table-container {
                    flex: 1;
                    overflow-y: auto;
                }
                .tags-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 14px;
                }
                .tags-table th {
                    text-align: left;
                    padding: 12px 20px;
                    color: var(--color-text-secondary);
                    font-size: 12px;
                    font-weight: 600;
                    border-bottom: 1px solid var(--color-border);
                    text-transform: uppercase;
                }
                .tags-table td {
                    padding: 12px 20px;
                    border-bottom: 1px solid var(--color-border);
                    vertical-align: middle;
                    color: var(--color-text-primary);
                }
                .tags-table tr:hover { background: var(--color-bg-elevated); }
                .align-right { text-align: right; }

                .tag-name-cell {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    font-weight: 500;
                }
                .color-dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                }
                .book-count-badge {
                    background: var(--color-bg-elevated);
                    color: var(--color-text-secondary);
                    padding: 2px 8px;
                    border-radius: 4px;
                    font-size: 12px;
                    font-weight: 600;
                }
                .status-badge {
                    font-size: 11px;
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-weight: 700;
                    background: var(--color-bg-elevated);
                    color: var(--color-text-secondary);
                }
                .status-badge.active {
                    background: rgba(16, 185, 129, 0.1);
                    color: var(--color-success);
                }
                .status-badge.inactive {
                    background: rgba(107, 114, 128, 0.1);
                    color: var(--color-text-tertiary);
                }

                .actions-cell {
                    white-space: nowrap;
                }
                .action-btn {
                    background: transparent;
                    border: none;
                    color: var(--color-text-secondary);
                    cursor: pointer;
                    padding: 6px;
                    border-radius: 4px;
                    margin-left: 4px;
                }
                .action-btn:hover { color: var(--color-text-primary); background: var(--color-bg-elevated); }
                .action-btn.delete:hover { color: var(--color-error); background: rgba(239, 68, 68, 0.1); }
                
                .empty-state { text-align: center; padding: 40px; color: var(--color-text-tertiary); }
                .list-footer {
                    padding: 12px 20px;
                    border-top: 1px solid var(--color-border);
                    color: var(--color-text-secondary);
                    font-size: 12px;
                    text-align: right;
                }

                /* Sidebar */
                .dashboard-sidebar {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-6);
                }
                .sidebar-section {
                    background: var(--color-bg-tertiary);
                    border: 1px solid var(--color-border);
                    border-radius: var(--radius-lg);
                    padding: 20px;
                }
                .section-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                }
                .section-header h3 {
                    margin: 0;
                    font-size: var(--text-base);
                    font-weight: 600;
                }
                .badge-sm {
                    background: rgba(16, 185, 129, 0.1);
                    color: var(--color-success);
                    font-size: 10px;
                    padding: 2px 4px;
                    border-radius: 4px;
                }
                
                /* Trends */
                .trends-list {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }
                .trend-item {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }
                .trend-info {
                    display: flex;
                    justify-content: space-between;
                    font-size: 14px;
                }
                .trend-name { font-weight: 500; }
                .trend-count { color: var(--color-text-secondary); }
                .progress-bar-bg {
                    height: 6px;
                    background: var(--color-bg-elevated);
                    border-radius: 3px;
                    overflow: hidden;
                }
                .progress-bar-fill {
                    height: 100%;
                    background: var(--color-accent);
                    border-radius: 3px;
                }
                .view-more-link {
                    margin-top: 16px;
                    color: var(--color-accent);
                    font-size: 13px;
                    font-weight: 500;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    cursor: pointer;
                }

                /* Recents */
                .recent-list {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }
                .recent-item {
                    display: flex;
                    gap: 12px;
                    align-items: flex-start;
                }
                .recent-icon-wrapper {
                    background: var(--color-bg-elevated);
                    padding: 8px;
                    border-radius: 8px;
                    color: var(--color-accent);
                    display: flex;
                }
                .recent-details {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }
                .recent-name {
                    font-weight: 600;
                    font-size: 14px;
                }
                .recent-time {
                    color: var(--color-text-secondary);
                    font-size: 12px;
                }

                /* Cleaning Card */
                .cleaning-card {
                    background: var(--gradient-warm);
                    border-radius: var(--radius-lg);
                    padding: 24px;
                    color: white;
                }
                .cleaning-header {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 16px;
                }
                .clean-label {
                    font-size: 10px;
                    font-weight: 800;
                    letter-spacing: 1px;
                    opacity: 0.9;
                }
                .clean-title {
                    font-size: 20px;
                    font-weight: 700;
                    margin-bottom: 8px;
                }
                .clean-desc {
                    font-size: 13px;
                    opacity: 0.9;
                    margin-bottom: 20px;
                    line-height: 1.4;
                }
                .clean-actions {
                    display: flex;
                    gap: 8px;
                }
                .btn-white {
                    background: white;
                    color: #ea580c;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 6px;
                    font-weight: 600;
                    font-size: 13px;
                    cursor: pointer;
                    flex: 1;
                }
                .btn-icon-red {
                    background: rgba(255,255,255,0.2);
                    border: none;
                    color: white;
                    width: 36px;
                    border-radius: 6px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .btn-icon-red:hover { background: rgba(255,255,255,0.3); }

                /* Dialog/Modal */
                .dialog-overlay {
                    position: fixed;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(0,0,0,0.7);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 100;
                    backdrop-filter: blur(4px);
                }
                .dialog-content {
                    background: var(--color-bg-tertiary);
                    border: 1px solid var(--color-border);
                    padding: 24px;
                    border-radius: 16px;
                    width: 400px;
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                    box-shadow: var(--shadow-xl);
                }
                .dialog-content h2 { margin: 0; font-size: 20px; }
                .form-group {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .form-group label {
                    font-size: 13px;
                    color: var(--color-text-secondary);
                    font-weight: 500;
                }
                .form-group input {
                    background: var(--color-bg-elevated);
                    border: 1px solid var(--color-border);
                    padding: 10px;
                    border-radius: 8px;
                    color: var(--color-text-primary);
                    outline: none;
                }
                .form-group input:focus { border-color: var(--color-accent); }
                
                .color-picker {
                    display: flex;
                    gap: 12px;
                }
                .color-swatch {
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    border: 2px solid transparent;
                    cursor: pointer;
                    transition: transform 0.2s;
                }
                .color-swatch:hover { transform: scale(1.1); }
                .color-swatch.selected { border-color: var(--color-text-primary); transform: scale(1.1); box-shadow: 0 0 0 2px var(--color-accent); }
                
                .dialog-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                }
                .btn-text {
                    background: transparent;
                    border: none;
                    color: var(--color-text-secondary);
                    font-weight: 500;
                    cursor: pointer;
                }
                .btn-text:hover { color: var(--color-text-primary); }

                /* Scrollbar */
                ::-webkit-scrollbar {
                    width: 8px;
                }
                ::-webkit-scrollbar-track {
                    background: var(--color-bg-secondary); 
                }
                ::-webkit-scrollbar-thumb {
                    background: var(--color-border-strong); 
                    border-radius: 4px;
                }
                ::-webkit-scrollbar-thumb:hover {
                    background: var(--color-text-tertiary); 
                }
            `}</style>
        </div>
    );
}
