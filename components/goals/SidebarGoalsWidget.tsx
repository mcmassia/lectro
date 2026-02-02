'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/stores/appStore';
import { getTimeStatsForUser, getReadingGoals, getStreakStats, ReadingGoals } from '@/lib/db';
import { Flame, Clock } from 'lucide-react';

export function SidebarGoalsWidget() {
    const { currentUser } = useAppStore();
    const [todayMinutes, setTodayMinutes] = useState(0);
    const [goals, setGoals] = useState<ReadingGoals | null>(null);
    const [streak, setStreak] = useState(0);

    useEffect(() => {
        async function loadData() {
            if (!currentUser) return;

            const [timeStats, userGoals] = await Promise.all([
                getTimeStatsForUser(currentUser.id, 1),
                getReadingGoals(currentUser.id),
            ]);

            setTodayMinutes(timeStats.todayMinutes);
            setGoals(userGoals);

            const streakStats = await getStreakStats(currentUser.id, userGoals.dailyTimeGoalMinutes);
            setStreak(streakStats.currentReadingStreak);
        }

        loadData();
    }, [currentUser]);

    const goalMinutes = goals?.dailyTimeGoalMinutes || 15;
    const progress = Math.min((todayMinutes / goalMinutes) * 100, 100);

    // Format time
    const formatTime = (minutes: number) => {
        const hours = Math.floor(minutes / 60);
        const mins = Math.round(minutes % 60);
        if (hours > 0) {
            return `${hours}h ${mins}m`;
        }
        return `${mins}m`;
    };

    // SVG parameters for mini ring
    const size = 48;
    const strokeWidth = 4;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (progress / 100) * circumference;
    const center = size / 2;

    return (
        <div className="sidebar-goals-widget">
            <div className="goal-row">
                <div className="mini-ring-container">
                    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
                        <circle
                            className="ring-bg"
                            cx={center}
                            cy={center}
                            r={radius}
                            strokeWidth={strokeWidth}
                        />
                        <circle
                            className="ring-progress"
                            cx={center}
                            cy={center}
                            r={radius}
                            strokeWidth={strokeWidth}
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                        />
                    </svg>
                    <div className="ring-center">
                        <Clock size={16} />
                    </div>
                </div>
                <div className="goal-info">
                    <span className="goal-value">{formatTime(todayMinutes)}</span>
                    <span className="goal-label">hoy de {goalMinutes}min</span>
                </div>
            </div>

            <div className="streak-row">
                <div className="streak-icon">
                    <Flame size={18} />
                </div>
                <div className="streak-info">
                    <span className="streak-value">{streak}</span>
                    <span className="streak-label">días racha</span>
                </div>
            </div>

            <style jsx>{`
        .sidebar-goals-widget {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }

        .goal-row {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }

        .mini-ring-container {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .ring-bg {
          fill: none;
          stroke: var(--color-bg-tertiary);
        }

        .ring-progress {
          fill: none;
          stroke: url(#sidebarGradient);
          stroke-linecap: round;
          transform: rotate(-90deg);
          transform-origin: center;
          transition: stroke-dashoffset 0.6s ease;
        }

        .mini-ring-container svg {
          overflow: visible;
        }

        .mini-ring-container svg defs {
          display: block;
        }

        .ring-center {
          position: absolute;
          color: var(--color-accent);
        }

        .goal-info {
          display: flex;
          flex-direction: column;
        }

        .goal-value {
          font-size: var(--text-lg);
          font-weight: 700;
          color: var(--color-text-primary);
          line-height: 1.2;
        }

        .goal-label {
          font-size: var(--text-xs);
          color: var(--color-text-tertiary);
        }

        .streak-row {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding: var(--space-2) var(--space-3);
          background: linear-gradient(135deg, 
            rgba(251, 146, 60, 0.1), 
            rgba(249, 115, 22, 0.05)
          );
          border-radius: var(--radius-md);
        }

        .streak-icon {
          color: #f97316;
        }

        .streak-info {
          display: flex;
          align-items: baseline;
          gap: var(--space-1);
        }

        .streak-value {
          font-size: var(--text-base);
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .streak-label {
          font-size: var(--text-xs);
          color: var(--color-text-secondary);
        }
      `}</style>

            {/* SVG Gradient Definition */}
            <svg width="0" height="0" style={{ position: 'absolute' }}>
                <defs>
                    <linearGradient id="sidebarGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#3b82f6" />
                        <stop offset="100%" stopColor="#8b5cf6" />
                    </linearGradient>
                </defs>
            </svg>
        </div>
    );
}
