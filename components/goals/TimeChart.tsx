'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/stores/appStore';
import { getTimeStatsForUser } from '@/lib/db';

interface ChartData {
    date: string;
    minutes: number;
    label: string;
}

interface TimeChartProps {
    days?: 7 | 30;
}

export function TimeChart({ days = 7 }: TimeChartProps) {
    const { currentUser } = useAppStore();
    const [data, setData] = useState<ChartData[]>([]);
    const [selectedDay, setSelectedDay] = useState<ChartData | null>(null);

    useEffect(() => {
        async function loadData() {
            if (!currentUser) return;

            const stats = await getTimeStatsForUser(currentUser.id, days);

            // Generate chart data for the last N days
            const chartData: ChartData[] = [];
            const today = new Date();

            for (let i = days - 1; i >= 0; i--) {
                const date = new Date(today);
                date.setDate(date.getDate() - i);
                const dateKey = date.toISOString().split('T')[0];
                const minutes = stats.dailyTimeMinutes[dateKey] || 0;

                chartData.push({
                    date: dateKey,
                    minutes: Math.round(minutes),
                    label: date.toLocaleDateString('es', { weekday: 'short', day: 'numeric' }),
                });
            }

            setData(chartData);
        }

        loadData();
    }, [currentUser, days]);

    const maxMinutes = Math.max(...data.map(d => d.minutes), 1);
    const totalMinutes = data.reduce((sum, d) => sum + d.minutes, 0);

    const formatTime = (minutes: number) => {
        const hours = Math.floor(minutes / 60);
        const mins = Math.round(minutes % 60);
        if (hours > 0) {
            return `${hours}h ${mins}m`;
        }
        return `${mins}m`;
    };

    return (
        <div className="time-chart">
            <div className="chart-header">
                <h3 className="chart-title">Tu progreso de lectura</h3>
                <span className="chart-total">
                    Total: {formatTime(totalMinutes)}
                </span>
            </div>

            <div className="chart-container">
                <div className="chart-bars">
                    {data.map((item, index) => (
                        <div
                            key={item.date}
                            className={`bar-column ${selectedDay?.date === item.date ? 'selected' : ''}`}
                            onClick={() => setSelectedDay(selectedDay?.date === item.date ? null : item)}
                        >
                            <div className="bar-wrapper">
                                <div
                                    className="bar"
                                    style={{
                                        height: `${Math.max((item.minutes / maxMinutes) * 100, 2)}%`,
                                    }}
                                />
                                {item.minutes > 0 && selectedDay?.date === item.date && (
                                    <div className="bar-tooltip">
                                        {formatTime(item.minutes)}
                                    </div>
                                )}
                            </div>
                            <span className="bar-label">{item.label}</span>
                        </div>
                    ))}
                </div>

                {/* Threshold line */}
                <div className="chart-grid">
                    {[0.25, 0.5, 0.75].map(ratio => (
                        <div
                            key={ratio}
                            className="grid-line"
                            style={{ bottom: `${ratio * 100}%` }}
                        />
                    ))}
                </div>
            </div>

            {selectedDay && (
                <div className="selected-info">
                    <span className="selected-date">
                        {new Date(selectedDay.date).toLocaleDateString('es', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long'
                        })}
                    </span>
                    <span className="selected-time">
                        {formatTime(selectedDay.minutes)}
                    </span>
                </div>
            )}

            <style jsx>{`
        .time-chart {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
          padding: var(--space-5);
          background: var(--color-bg-elevated);
          border-radius: var(--radius-xl);
          border: 1px solid var(--color-border);
        }

        .chart-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .chart-title {
          font-size: var(--text-base);
          font-weight: 600;
          color: var(--color-text-primary);
          margin: 0;
        }

        .chart-total {
          font-size: var(--text-sm);
          color: var(--color-text-secondary);
          background: var(--color-bg-tertiary);
          padding: var(--space-1) var(--space-3);
          border-radius: var(--radius-full);
        }

        .chart-container {
          position: relative;
          height: 160px;
          padding-bottom: 24px;
        }

        .chart-bars {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          height: 100%;
          gap: var(--space-1);
          position: relative;
          z-index: 2;
        }

        .bar-column {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-2);
          cursor: pointer;
        }

        .bar-wrapper {
          width: 100%;
          height: 120px;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          align-items: center;
          position: relative;
        }

        .bar {
          width: 100%;
          max-width: 32px;
          background: linear-gradient(180deg, #3b82f6, #6366f1);
          border-radius: var(--radius-sm) var(--radius-sm) 0 0;
          transition: all 0.3s ease;
          min-height: 2px;
        }

        .bar-column:hover .bar {
          background: linear-gradient(180deg, #60a5fa, #818cf8);
          transform: scaleX(1.1);
        }

        .bar-column.selected .bar {
          background: linear-gradient(180deg, #10b981, #34d399);
        }

        .bar-tooltip {
          position: absolute;
          bottom: 100%;
          margin-bottom: 4px;
          background: var(--color-bg-primary);
          color: var(--color-text-primary);
          padding: 4px 8px;
          border-radius: var(--radius-sm);
          font-size: 11px;
          font-weight: 600;
          white-space: nowrap;
          box-shadow: var(--shadow-md);
          border: 1px solid var(--color-border);
        }

        .bar-label {
          font-size: 10px;
          color: var(--color-text-tertiary);
          text-transform: capitalize;
        }

        .chart-grid {
          position: absolute;
          inset: 0;
          bottom: 24px;
          pointer-events: none;
        }

        .grid-line {
          position: absolute;
          left: 0;
          right: 0;
          height: 1px;
          background: var(--color-border);
          opacity: 0.5;
        }

        .selected-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--space-3);
          background: var(--color-bg-tertiary);
          border-radius: var(--radius-md);
        }

        .selected-date {
          font-size: var(--text-sm);
          color: var(--color-text-secondary);
          text-transform: capitalize;
        }

        .selected-time {
          font-size: var(--text-base);
          font-weight: 600;
          color: var(--color-accent);
        }
      `}</style>
        </div>
    );
}
