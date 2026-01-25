'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/stores/appStore';
import { getReadingStatsForUser } from '@/lib/db';

interface DailyData {
  date: string;
  pages: number;
}

export default function StatsPage() {
  const { dailyReadingGoal, setDailyReadingGoal, currentUser } = useAppStore();
  const [stats, setStats] = useState({
    totalPages: 0,
    totalMinutes: 0,
    averagePagesPerDay: 0,
    activeDays: 0,
    currentStreak: 0,
    dailyStats: {} as Record<string, number>,
  });
  const [timeRange, setTimeRange] = useState<30 | 90 | 365>(30);

  useEffect(() => {
    async function loadStats() {
      if (!currentUser) return;
      const data = await getReadingStatsForUser(currentUser.id, timeRange);
      setStats(data);
    }
    loadStats();
  }, [timeRange, currentUser]);

  // Generate heatmap data for the last 12 weeks
  const generateHeatmapData = () => {
    const weeks: DailyData[][] = [];
    const today = new Date();

    for (let w = 11; w >= 0; w--) {
      const week: DailyData[] = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(today);
        date.setDate(date.getDate() - (w * 7 + (6 - d)));
        const dateKey = date.toISOString().split('T')[0];
        week.push({
          date: dateKey,
          pages: stats.dailyStats[dateKey] || 0,
        });
      }
      weeks.push(week);
    }

    return weeks;
  };

  const heatmapData = generateHeatmapData();
  const maxPages = Math.max(...Object.values(stats.dailyStats), dailyReadingGoal);

  const getHeatmapColor = (pages: number) => {
    if (pages === 0) return 'var(--color-bg-tertiary)';
    const intensity = Math.min(pages / maxPages, 1);
    if (intensity < 0.25) return 'rgba(0, 122, 255, 0.2)';
    if (intensity < 0.5) return 'rgba(0, 122, 255, 0.4)';
    if (intensity < 0.75) return 'rgba(0, 122, 255, 0.6)';
    return 'rgba(0, 122, 255, 0.9)';
  };

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Estadísticas</h1>
          <p className="page-subtitle">Tu progreso de lectura</p>
        </div>
        <div className="time-range-selector">
          {([30, 90, 365] as const).map((range) => (
            <button
              key={range}
              className={`range-btn ${timeRange === range ? 'active' : ''}`}
              onClick={() => setTimeRange(range)}
            >
              {range === 30 ? '30 días' : range === 90 ? '90 días' : '1 año'}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Overview */}
      <section className="stats-overview">
        <div className="stat-card featured">
          <div className="stat-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="32" height="32">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          </div>
          <div className="stat-value">{stats.totalPages.toLocaleString()}</div>
          <div className="stat-label">Páginas leídas</div>
        </div>

        <div className="stat-card">
          <div className="stat-value">{Math.round(stats.totalMinutes / 60)}</div>
          <div className="stat-label">Horas de lectura</div>
        </div>

        <div className="stat-card">
          <div className="stat-value">{stats.averagePagesPerDay}</div>
          <div className="stat-label">Páginas/día promedio</div>
        </div>

        <div className="stat-card">
          <div className="stat-value">{stats.currentStreak}</div>
          <div className="stat-label">Días de racha</div>
        </div>

        <div className="stat-card">
          <div className="stat-value">{stats.activeDays}</div>
          <div className="stat-label">Días activos</div>
        </div>
      </section>

      {/* Reading Heatmap */}
      <section className="heatmap-section card">
        <h2 className="heading-4">Actividad de lectura</h2>
        <p className="body-small" style={{ marginBottom: 'var(--space-4)' }}>
          Últimas 12 semanas
        </p>

        <div className="heatmap-container">
          <div className="heatmap-labels">
            <span>Lun</span>
            <span>Mié</span>
            <span>Vie</span>
          </div>
          <div className="heatmap-grid">
            {heatmapData.map((week, wi) => (
              <div key={wi} className="heatmap-week">
                {week.map((day, di) => (
                  <div
                    key={di}
                    className="heatmap-day"
                    style={{ backgroundColor: getHeatmapColor(day.pages) }}
                    title={`${day.date}: ${day.pages} páginas`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="heatmap-legend">
          <span>Menos</span>
          <div className="legend-scale">
            <div style={{ backgroundColor: 'var(--color-bg-tertiary)' }} />
            <div style={{ backgroundColor: 'rgba(0, 122, 255, 0.2)' }} />
            <div style={{ backgroundColor: 'rgba(0, 122, 255, 0.4)' }} />
            <div style={{ backgroundColor: 'rgba(0, 122, 255, 0.6)' }} />
            <div style={{ backgroundColor: 'rgba(0, 122, 255, 0.9)' }} />
          </div>
          <span>Más</span>
        </div>
      </section>

      {/* Reading Goal */}
      <section className="goal-section card">
        <h2 className="heading-4">Meta diaria</h2>
        <div className="goal-config">
          <input
            type="range"
            min="5"
            max="100"
            step="5"
            value={dailyReadingGoal}
            onChange={(e) => setDailyReadingGoal(Number(e.target.value))}
            className="goal-slider"
          />
          <div className="goal-value">
            <span className="goal-number">{dailyReadingGoal}</span>
            <span className="goal-unit">páginas/día</span>
          </div>
        </div>
      </section>

      <style jsx>{`
        .time-range-selector {
          display: flex;
          gap: var(--space-2);
          background: var(--color-bg-tertiary);
          padding: var(--space-1);
          border-radius: var(--radius-md);
        }

        .range-btn {
          padding: var(--space-2) var(--space-4);
          font-size: var(--text-sm);
          background: transparent;
          border: none;
          border-radius: var(--radius-sm);
          color: var(--color-text-secondary);
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .range-btn.active {
          background: var(--color-bg-elevated);
          color: var(--color-text-primary);
          box-shadow: var(--shadow-sm);
        }

        .stats-overview {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: var(--space-4);
          margin-bottom: var(--space-8);
        }

        .stat-card.featured {
          grid-column: span 1;
          background: var(--gradient-accent);
          color: white;
        }

        .stat-card.featured .stat-label {
          color: rgba(255, 255, 255, 0.8);
        }

        .stat-icon {
          margin-bottom: var(--space-3);
        }

        .heatmap-section {
          margin-bottom: var(--space-8);
        }

        .heatmap-container {
          display: flex;
          gap: var(--space-2);
        }

        .heatmap-labels {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          font-size: var(--text-xs);
          color: var(--color-text-tertiary);
          padding: var(--space-1) 0;
        }

        .heatmap-grid {
          display: flex;
          gap: 3px;
          flex: 1;
        }

        .heatmap-week {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .heatmap-day {
          width: 14px;
          height: 14px;
          border-radius: 3px;
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .heatmap-day:hover {
          transform: scale(1.2);
        }

        .heatmap-legend {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          justify-content: flex-end;
          margin-top: var(--space-4);
          font-size: var(--text-xs);
          color: var(--color-text-tertiary);
        }

        .legend-scale {
          display: flex;
          gap: 2px;
        }

        .legend-scale div {
          width: 12px;
          height: 12px;
          border-radius: 2px;
        }

        .goal-config {
          display: flex;
          align-items: center;
          gap: var(--space-6);
          margin-top: var(--space-4);
        }

        .goal-slider {
          flex: 1;
          height: 8px;
          border-radius: var(--radius-full);
          accent-color: var(--color-accent);
        }

        .goal-value {
          display: flex;
          align-items: baseline;
          gap: var(--space-2);
        }

        .goal-number {
          font-size: var(--text-3xl);
          font-weight: 700;
          color: var(--color-accent);
        }

        .goal-unit {
          font-size: var(--text-sm);
          color: var(--color-text-tertiary);
        }

        @media (max-width: 768px) {
          .stats-overview {
            grid-template-columns: repeat(2, 1fr);
          }

          .stat-card.featured {
            grid-column: span 2;
          }
        }
      `}</style>
    </div>
  );
}
