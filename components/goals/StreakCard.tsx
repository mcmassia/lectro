'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/stores/appStore';
import { getStreakStats, getReadingGoals, ReadingGoals } from '@/lib/db';
import { Flame, Trophy, Target, Star } from 'lucide-react';

export function StreakCard() {
  const { currentUser } = useAppStore();
  const [streakStats, setStreakStats] = useState({
    currentReadingStreak: 0,
    currentGoalStreak: 0,
    goalMetDays: 0,
  });
  const [goals, setGoals] = useState<ReadingGoals | null>(null);
  const [isRecord, setIsRecord] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!currentUser) return;

      const userGoals = await getReadingGoals(currentUser.id);
      setGoals(userGoals);

      const stats = await getStreakStats(currentUser.id, userGoals.dailyTimeGoalMinutes);
      setStreakStats(stats);

      // Check if current streak is a record
      setIsRecord(stats.currentReadingStreak > 0 && stats.currentReadingStreak >= userGoals.streakRecord);
    }

    loadData();
  }, [currentUser]);

  return (
    <div className="streak-card-container">
      {/* Main Streak Card */}
      <div className={`streak-card main ${isRecord ? 'is-record' : ''}`}>
        <div className="streak-icon">
          <Flame size={28} />
        </div>
        <div className="streak-content">
          <span className="streak-label">Días seguidos leyendo</span>
          <div className="streak-value-row">
            <span className="streak-value">{streakStats.currentReadingStreak}</span>
            <span className="streak-unit">días</span>
            {isRecord && streakStats.currentReadingStreak > 0 && (
              <span className="record-badge">
                <Star size={12} />
                Récord
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-item">
          <div className="stat-icon goal">
            <Target size={18} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{streakStats.currentGoalStreak}</span>
            <span className="stat-label">Racha de meta cumplida</span>
          </div>
        </div>

        <div className="stat-item">
          <div className="stat-icon trophy">
            <Trophy size={18} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{streakStats.goalMetDays}</span>
            <span className="stat-label">Días con objetivo</span>
          </div>
        </div>

        {goals?.streakRecord && goals.streakRecord > 0 && (
          <div className="stat-item">
            <div className="stat-icon star">
              <Star size={18} />
            </div>
            <div className="stat-content">
              <span className="stat-value">{goals.streakRecord}</span>
              <span className="stat-label">Récord de racha</span>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .streak-card-container {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
          width: 100%;
        }

        .streak-card {
          display: flex;
          align-items: center;
          gap: var(--space-4);
          padding: var(--space-5);
          background: var(--color-bg-elevated);
          border-radius: var(--radius-xl);
          border: 1px solid var(--color-border);
          transition: all 0.3s;
        }

        .streak-card.main {
          background: linear-gradient(135deg, 
            rgba(251, 146, 60, 0.1), 
            rgba(249, 115, 22, 0.05)
          );
          border-color: rgba(251, 146, 60, 0.3);
        }

        .streak-card.is-record {
          background: linear-gradient(135deg, 
            rgba(251, 146, 60, 0.2), 
            rgba(234, 179, 8, 0.1)
          );
          border-color: rgba(251, 146, 60, 0.5);
          box-shadow: 0 0 20px rgba(251, 146, 60, 0.15);
        }

        .streak-icon {
          width: 56px;
          height: 56px;
          background: linear-gradient(135deg, #f97316, #fb923c);
          border-radius: var(--radius-lg);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          box-shadow: 0 4px 12px rgba(249, 115, 22, 0.3);
        }

        .streak-content {
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
        }

        .streak-label {
          font-size: var(--text-sm);
          color: var(--color-text-secondary);
        }

        .streak-value-row {
          display: flex;
          align-items: baseline;
          gap: var(--space-2);
        }

        .streak-value {
          font-size: 36px;
          font-weight: 700;
          color: var(--color-text-primary);
          line-height: 1;
        }

        .streak-unit {
          font-size: var(--text-lg);
          color: var(--color-text-secondary);
        }

        .record-badge {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          background: linear-gradient(135deg, #eab308, #f59e0b);
          color: white;
          font-size: 11px;
          font-weight: 600;
          border-radius: var(--radius-full);
          margin-left: var(--space-2);
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: var(--space-3);
        }

        .stat-item {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding: var(--space-4);
          background: var(--color-bg-tertiary);
          border-radius: var(--radius-lg);
        }

        .stat-icon {
          width: 40px;
          height: 40px;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }

        .stat-icon.goal {
          background: linear-gradient(135deg, #3b82f6, #6366f1);
        }

        .stat-icon.trophy {
          background: linear-gradient(135deg, #10b981, #34d399);
        }

        .stat-icon.star {
          background: linear-gradient(135deg, #eab308, #f59e0b);
        }

        .stat-content {
          display: flex;
          flex-direction: column;
        }

        .stat-item .stat-value {
          font-size: var(--text-xl);
          font-weight: 700;
          color: var(--color-text-primary);
          line-height: 1.2;
        }

        .stat-item .stat-label {
          font-size: var(--text-xs);
          color: var(--color-text-tertiary);
        }

        @media (max-width: 768px) {
          .streak-card-container {
            gap: var(--space-3);
          }

          .streak-card {
            padding: var(--space-4);
          }

          .streak-icon {
            width: 44px;
            height: 44px;
          }

          .streak-icon :global(svg) {
            width: 22px;
            height: 22px;
          }

          .streak-value {
            font-size: 28px;
          }

          .streak-unit {
            font-size: var(--text-base);
          }

          .stats-grid {
            grid-template-columns: 1fr 1fr;
            gap: var(--space-2);
          }

          .stat-item {
            padding: var(--space-3);
            gap: var(--space-2);
          }

          .stat-icon {
            width: 32px;
            height: 32px;
          }

          .stat-icon :global(svg) {
            width: 16px;
            height: 16px;
          }

          .stat-item .stat-value {
            font-size: var(--text-lg);
          }

          .stat-item .stat-label {
            font-size: 10px;
          }

          .record-badge {
            padding: 2px 6px;
            font-size: 9px;
            margin-left: var(--space-1);
          }
        }
      `}</style>
    </div>
  );
}
