'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/stores/appStore';
import { getReadingStatsForUser } from '@/lib/db';

interface Stats {
  todayPages: number;
  goalPages: number;
  weeklyPages: number;
  streak: number;
}

interface ActivityRingsProps {
  size?: 'sm' | 'md' | 'lg';
}

export function ActivityRings({ size = 'md' }: ActivityRingsProps) {
  const { dailyReadingGoal, currentUser } = useAppStore();
  const [stats, setStats] = useState<Stats>({
    todayPages: 0,
    goalPages: dailyReadingGoal,
    weeklyPages: 0,
    streak: 0,
  });

  useEffect(() => {
    async function loadStats() {
      if (!currentUser) return;
      try {
        const data = await getReadingStatsForUser(currentUser.id, 7);
        const today = new Date().toISOString().split('T')[0];
        const todayPages = data.dailyStats[today] || 0;

        setStats({
          todayPages,
          goalPages: dailyReadingGoal,
          weeklyPages: data.totalPages, // totalPages in range is more like 'weekly pages' if range is 7 days
          streak: data.currentStreak,
        });
      } catch (error) {
        console.error('Failed to load stats:', error);
      }
    }

    loadStats();
  }, [dailyReadingGoal, currentUser]);

  const progress = Math.min((stats.todayPages / stats.goalPages) * 100, 100);

  // Size configuration
  const config = {
    sm: { size: 100, radius: 35, stroke: 6, fontSize: 'var(--text-xl)', labelSize: '9px' },
    md: { size: 120, radius: 45, stroke: 8, fontSize: 'var(--text-2xl)', labelSize: 'var(--text-xs)' },
    lg: { size: 160, radius: 60, stroke: 10, fontSize: 'var(--text-3xl)', labelSize: 'var(--text-sm)' },
  }[size];

  const circumference = 2 * Math.PI * config.radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;
  const center = config.size / 2;

  return (
    <div className="activity-container">
      <div className="activity-ring" style={{ width: config.size, height: config.size }}>
        <svg viewBox={`0 0 ${config.size} ${config.size}`} width={config.size} height={config.size}>
          <circle
            className="activity-ring-bg"
            cx={center}
            cy={center}
            r={config.radius}
            style={{ strokeWidth: config.stroke }}
          />
          <circle
            className="activity-ring-progress"
            cx={center}
            cy={center}
            r={config.radius}
            stroke="url(#progressGradient)"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{ strokeWidth: config.stroke }}
          />
          <defs>
            <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#007AFF" />
              <stop offset="100%" stopColor="#5856D6" />
            </linearGradient>
          </defs>
        </svg>
        <div className="activity-ring-center">
          <span className="activity-value" style={{ fontSize: config.fontSize }}>{stats.todayPages}</span>
          <span className="activity-label" style={{ fontSize: config.labelSize }}>páginas</span>
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
        }

        .activity-ring-progress {
          fill: none;
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
