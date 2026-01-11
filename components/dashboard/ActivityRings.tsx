'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/stores/appStore';
import { getReadingStats } from '@/lib/db';

interface Stats {
    todayPages: number;
    goalPages: number;
    weeklyPages: number;
    streak: number;
}

export function ActivityRings() {
    const { dailyReadingGoal } = useAppStore();
    const [stats, setStats] = useState<Stats>({
        todayPages: 0,
        goalPages: dailyReadingGoal,
        weeklyPages: 0,
        streak: 0,
    });

    useEffect(() => {
        async function loadStats() {
            try {
                const data = await getReadingStats(7);
                const today = new Date().toISOString().split('T')[0];
                const todayPages = data.dailyStats[today] || 0;

                setStats({
                    todayPages,
                    goalPages: dailyReadingGoal,
                    weeklyPages: data.totalPages,
                    streak: data.currentStreak,
                });
            } catch (error) {
                console.error('Failed to load stats:', error);
            }
        }

        loadStats();
    }, [dailyReadingGoal]);

    const progress = Math.min((stats.todayPages / stats.goalPages) * 100, 100);
    const circumference = 2 * Math.PI * 45;
    const strokeDashoffset = circumference - (progress / 100) * circumference;

    return (
        <div className="activity-container">
            <div className="activity-ring">
                <svg viewBox="0 0 120 120" width="120" height="120">
                    <circle
                        className="activity-ring-bg"
                        cx="60"
                        cy="60"
                        r="45"
                    />
                    <circle
                        className="activity-ring-progress"
                        cx="60"
                        cy="60"
                        r="45"
                        stroke="url(#progressGradient)"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                    />
                    <defs>
                        <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#007AFF" />
                            <stop offset="100%" stopColor="#5856D6" />
                        </linearGradient>
                    </defs>
                </svg>
                <div className="activity-ring-center">
                    <span className="activity-value">{stats.todayPages}</span>
                    <span className="activity-label">páginas</span>
                </div>
            </div>

            <div className="activity-stats">
                <div className="activity-stat">
                    <span className="stat-number">{stats.goalPages}</span>
                    <span className="stat-label">meta diaria</span>
                </div>
                <div className="activity-stat">
                    <span className="stat-number">{stats.weeklyPages}</span>
                    <span className="stat-label">esta semana</span>
                </div>
                <div className="activity-stat">
                    <span className="stat-number">{stats.streak}</span>
                    <span className="stat-label">días racha</span>
                </div>
            </div>

            <style jsx>{`
        .activity-container {
          display: flex;
          align-items: center;
          gap: var(--space-8);
        }

        .activity-ring-bg {
          fill: none;
          stroke: var(--color-bg-tertiary);
          stroke-width: 8;
        }

        .activity-ring-progress {
          fill: none;
          stroke-width: 8;
          stroke-linecap: round;
          transform: rotate(-90deg);
          transform-origin: center;
          transition: stroke-dashoffset 0.5s ease;
        }

        .activity-ring-center {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }

        .activity-value {
          font-size: var(--text-2xl);
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .activity-label {
          font-size: var(--text-xs);
          color: var(--color-text-tertiary);
        }

        .activity-stats {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }

        .activity-stat {
          display: flex;
          flex-direction: column;
        }

        .stat-number {
          font-size: var(--text-xl);
          font-weight: 600;
          color: var(--color-text-primary);
        }

        .stat-label {
          font-size: var(--text-xs);
          color: var(--color-text-tertiary);
        }
      `}</style>
        </div>
    );
}
