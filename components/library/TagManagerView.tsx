import React, { useState, useMemo } from 'react';
import { useLibraryStore } from '@/stores/appStore';
import {
    Search, Filter, TrendingUp, BookOpen, BarChart3
} from 'lucide-react';
import { BookCategory, db } from '@/lib/db';

// Definición de categorías (Duplicada de BookDetailsModal para consistencia visual)
const CATEGORIES: { id: BookCategory; icon: string; label: string; desc: string }[] = [
    { id: 'Pensamiento', icon: '🧠', label: 'Pensamiento', desc: 'Filosofía, ética, lógica' },
    { id: 'Espiritualidad', icon: '✨', label: 'Espiritualidad', desc: 'Religión, teología, mística' },
    { id: 'Sociedad', icon: '🌍', label: 'Sociedad', desc: 'Historia, política, sociología' },
    { id: 'Ciencia', icon: '🔬', label: 'Ciencia', desc: 'Ciencia, física, biología' },
    { id: 'Tecnología', icon: '💻', label: 'Tecnología', desc: 'Tecnología, informática, IA' },
    { id: 'Narrativa', icon: '📖', label: 'Narrativa', desc: 'Novela, cuento, ficción' },
    { id: 'PoesíaDrama', icon: '🎭', label: 'Poesía/Drama', desc: 'Poesía, teatro' },
    { id: 'ArteCultura', icon: '🎨', label: 'Arte/Cultura', desc: 'Arte, música, cine' },
    { id: 'Crecimiento', icon: '🌱', label: 'Crecimiento', desc: 'Psicología, autoayuda' },
    { id: 'Práctica', icon: '🔧', label: 'Práctica', desc: 'Manuales, cocina, guías' },
];

export default function TagManagerView() {
    const { books } = useLibraryStore();
    const [searchTerm, setSearchTerm] = useState('');
    const [viewFilter, setViewFilter] = useState<'all' | 'active' | 'unused'>('all');
    const [isProcessing, setIsProcessing] = useState(false);

    const handleClearCategories = async () => {
        if (!confirm('¿Estás seguro de que quieres RESTABLECER las categorías Automáticas?\n\nLas categorías que añadiste manualmente NO se borrarán.')) return;

        setIsProcessing(true);
        try {
            const allBooks = await db.books.toArray();
            await db.transaction('rw', db.books, async () => {
                for (const book of allBooks) {
                    if (book.metadata?.categories?.length || (book.metadata as any)?.category) {
                        // Reset to manual only (preserving manual tags)
                        const manualCats = book.metadata.manualCategories || [];
                        const newMeta = {
                            ...book.metadata,
                            categories: manualCats,
                            category: undefined
                        };
                        await db.books.update(book.id, { metadata: newMeta });
                    }
                }
            });
            await useLibraryStore.getState().loadBooks();
            alert('Todas las categorías han sido eliminadas.');
        } catch (e) {
            console.error(e);
            alert('Error al limpiar categorías.');
        } finally {
            setIsProcessing(false);
        }
    };

    // Stats Calculation
    const stats = useMemo(() => {
        const usage: Record<string, number> = {};

        // Initialize counts
        CATEGORIES.forEach(cat => { usage[cat.id] = 0; });

        // Count usage
        books.forEach(b => {
            const categories = b.metadata?.categories || [];

            // Si es legacy (string único), convertir a array en caliente (no persiste a BD aquí para evitar re-renders masivos,
            // pero lo cuenta correctamente para la UI)
            const legacyCategory = (b.metadata as any)?.category;
            if (legacyCategory && !categories.includes(legacyCategory) && legacyCategory !== 'SinClasificar') {
                // Solo contamos, no mutamos el store dentro de useMemo
                usage[legacyCategory] = (usage[legacyCategory] || 0) + 1;
            }

            categories.forEach(cat => {
                if (usage[cat] !== undefined) {
                    usage[cat]++;
                }
            });
        });

        const activeCount = Object.values(usage).filter(c => c > 0).length;
        const totalCount = CATEGORIES.length;
        const emptyCount = CATEGORIES.filter(cat => usage[cat.id] === 0).length;

        // Top Categories
        const topCategories = CATEGORIES
            .map(cat => ({ ...cat, count: usage[cat.id] || 0 }))
            .sort((a, b) => b.count - a.count);

        return { usage, activeCount, totalCount, emptyCount, topCategories };
    }, [books]);

    // Filtered List
    const filteredCategories = useMemo(() => {
        return CATEGORIES.filter(cat => {
            const matchesSearch = cat.label.toLowerCase().includes(searchTerm.toLowerCase());
            const count = stats.usage[cat.id] || 0;
            const matchesView =
                viewFilter === 'all' ? true :
                    viewFilter === 'active' ? count > 0 :
                        viewFilter === 'unused' ? count === 0 : true;

            return matchesSearch && matchesView;
        }).map(cat => ({
            ...cat,
            count: stats.usage[cat.id] || 0
        })).sort((a, b) => b.count - a.count); // Siempre ordenar por popularidad
    }, [searchTerm, viewFilter, stats.usage]);

    return (
        <div className="tag-dashboard">
            {/* Header */}
            <header className="dashboard-header">
                <div>
                    <h1 className="page-title">Gestión de Etiquetas</h1>
                    <p className="page-subtitle">Visualiza la distribución temática de tu biblioteca.</p>
                </div>
                <div className="header-actions">
                    <button
                        className="filter-btn"
                        onClick={handleClearCategories}
                        disabled={isProcessing}
                        style={{ color: '#ef4444', borderColor: '#ef4444' }}
                    >
                        {isProcessing ? 'Limpiando...' : 'Limpiar Categorías'}
                    </button>
                    <div className="search-bar">
                        <Search size={18} className="search-icon" />
                        <input
                            type="text"
                            placeholder="Buscar categoría..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </header>

            {/* Stats Row */}
            <div className="stats-row">
                <div className="stat-card">
                    <div className="stat-header">
                        <span className="stat-title">Categorías Totales</span>
                    </div>
                    <div className="stat-value">{stats.totalCount}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-header">
                        <span className="stat-title">En Uso</span>
                        <span className="stat-badge success">{Math.round((stats.activeCount / stats.totalCount) * 100)}%</span>
                    </div>
                    <div className="stat-value">{stats.activeCount}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-header">
                        <span className="stat-title">Libros Etiquetados</span>
                        <BookOpen size={20} className="text-secondary" />
                    </div>
                    <div className="stat-value">
                        {books.filter(b => (b.metadata?.categories?.length || 0) > 0 || (b.metadata as any)?.category).length}
                        <span className="stat-total"> / {books.length}</span>
                    </div>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="content-grid">
                {/* Master List */}
                <div className="master-list-panel">
                    <div className="panel-header">
                        <h3>Categorías Temáticas</h3>
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
                                    <th>CATEGORÍA</th>
                                    <th>DESCRIPCIÓN</th>
                                    <th>LIBROS</th>
                                    <th>ESTADO</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredCategories.map(cat => (
                                    <tr
                                        key={cat.id}
                                        onClick={() => {
                                            if (cat.count > 0) {
                                                useLibraryStore.getState().setActiveThematicCategory(cat.id);
                                                useLibraryStore.getState().setView('library');
                                            }
                                        }}
                                        style={{ cursor: cat.count > 0 ? 'pointer' : 'default' }}
                                    >
                                        <td>
                                            <div className="tag-name-cell">
                                                <span className="cat-icon">{cat.icon}</span>
                                                {cat.label}
                                            </div>
                                        </td>
                                        <td className="desc-cell">{cat.desc}</td>
                                        <td>
                                            <span className="book-count-badge">{cat.count}</span>
                                        </td>
                                        <td>
                                            <span className={`status-badge ${cat.count > 0 ? 'active' : 'inactive'}`}>
                                                {cat.count > 0 ? 'ACTIVA' : 'VACÍA'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {filteredCategories.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="empty-state">
                                            No se encontraron categorías
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="list-footer">
                        Viendo {filteredCategories.length} categorías
                    </div>
                </div>

                {/* Sidebar */}
                <div className="dashboard-sidebar">
                    {/* Top Trends */}
                    <div className="sidebar-section">
                        <div className="section-header">
                            <h3>Distribución</h3>
                            <BarChart3 size={16} className="text-secondary" />
                        </div>
                        <div className="trends-list">
                            {stats.topCategories.slice(0, 5).map(cat => (
                                <div key={cat.id} className="trend-item">
                                    <div className="trend-info">
                                        <span className="trend-name">
                                            <span className="trend-icon">{cat.icon}</span> {cat.label}
                                        </span>
                                        <span className="trend-count">{cat.count}</span>
                                    </div>
                                    <div className="progress-bar-bg">
                                        <div
                                            className="progress-bar-fill"
                                            style={{ width: `${stats.topCategories[0].count > 0 ? (cat.count / stats.topCategories[0].count) * 100 : 0}%` }}
                                        ></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

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
                .stat-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .stat-title {
                    font-size: var(--text-sm);
                    color: var(--color-text-secondary);
                }
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
                .stat-total {
                    font-size: 16px;
                    color: var(--color-text-tertiary);
                    font-weight: 500;
                }

                /* Content Grid */
                .content-grid {
                    display: grid;
                    grid-template-columns: 2fr 1fr;
                    gap: var(--space-6);
                    flex: 1;
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

                .tag-name-cell {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    font-weight: 500;
                }
                .cat-icon { font-size: 16px; }
                .desc-cell { color: var(--color-text-secondary); font-size: 13px; }
                
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
                .trend-name { font-weight: 500; display: flex; gap: 6px; align-items: center; }
                .trend-icon { font-size: 14px; }
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
                .text-secondary { color: var(--color-text-secondary); }
            `}</style>
        </div>
    );
}
