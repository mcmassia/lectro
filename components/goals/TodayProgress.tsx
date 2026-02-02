'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore, useLibraryStore } from '@/stores/appStore';
import { getTimeStatsForUser, getReadingGoals, ReadingGoals } from '@/lib/db';
import { BookOpen, ChevronRight } from 'lucide-react';

interface TodayProgressProps {
  onGoalClick?: () => void;
}

export function TodayProgress({ onGoalClick }: TodayProgressProps) {
  const { currentUser } = useAppStore();
  const { books } = useLibraryStore();
  const router = useRouter();

  const [todayMinutes, setTodayMinutes] = useState(0);
  const [goals, setGoals] = useState<ReadingGoals | null>(null);
  const [lastReadBookId, setLastReadBookId] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      if (!currentUser) return;

      const [timeStats, userGoals] = await Promise.all([
        getTimeStatsForUser(currentUser.id, 1),
        getReadingGoals(currentUser.id),
      ]);

      setTodayMinutes(timeStats.todayMinutes);
      setGoals(userGoals);

      // Find last read book
      const readingBooks = books
        .filter(b => b.status === 'reading' && b.lastReadAt)
        .sort((a, b) => (b.lastReadAt?.getTime() || 0) - (a.lastReadAt?.getTime() || 0));

      if (readingBooks.length > 0) {
        setLastReadBookId(readingBooks[0].id);
      }
    }

    loadData();
  }, [currentUser, books]);

  const goalMinutes = goals?.dailyTimeGoalMinutes || 15;
  const progress = Math.min((todayMinutes / goalMinutes) * 100, 100);
  const isGoalMet = todayMinutes >= goalMinutes;

  // Format time as H:MM or M:SS
  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}`;
    }
    return `${mins}`;
  };

  const handleKeepReading = () => {
    if (lastReadBookId) {
      router.push(`/reader/${lastReadBookId}`);
    } else if (books.length > 0) {
      router.push(`/reader/${books[0].id}`);
    }
  };

  // SVG parameters
  const size = 180;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;
  const center = size / 2;

  return (
    <div className="today-progress">
      <h2 className="section-title">Lectura de hoy</h2>

      <div className="progress-container">
        <div className="ring-container">
          <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
            {/* Background circle */}
            <circle
              className="ring-bg"
              cx={center}
              cy={center}
              r={radius}
              strokeWidth={strokeWidth}
            />
            {/* Progress circle */}
            <circle
              className="ring-progress"
              cx={center}
              cy={center}
              r={radius}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              stroke={isGoalMet ? 'url(#successGradient)' : 'url(#progressGradient)'}
            />
            <defs>
              <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>
              <linearGradient id="successGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#34d399" />
              </linearGradient>
            </defs>
          </svg>

          <div className="ring-center">
            <span className="time-value">{formatTime(todayMinutes)}</span>
            <span className="time-unit">{todayMinutes >= 60 ? 'horas' : 'min'}</span>
          </div>
        </div>

        <button className="goal-info" onClick={onGoalClick}>
          <span>de tu meta de {goalMinutes} minutos</span>
          <ChevronRight size={16} />
        </button>
      </div>

      <button className="keep-reading-btn" onClick={handleKeepReading}>
        <BookOpen size={20} />
        <div className="btn-text">
          <span className="btn-title">Seguir leyendo</span>
          {lastReadBookId && (
            <span className="btn-subtitle">
              {books.find(b => b.id === lastReadBookId)?.title || 'Continuar'}
            </span>
          )}
        </div>
      </button>

      <style jsx>{`
        .today-progress {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: var(--space-6);
        }

        .section-title {
          font-size: var(--text-lg);
          font-weight: 600;
          color: var(--color-text-primary);
        }

        .progress-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-4);
        }

        .ring-container {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .ring-bg {
          fill: none;
          stroke: var(--color-bg-tertiary);
        }

        .ring-progress {
          fill: none;
          stroke-linecap: round;
          transform: rotate(-90deg);
          transform-origin: center;
          transition: stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .ring-center {
          position: absolute;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }

        .time-value {
          font-size: 48px;
          font-weight: 700;
          color: var(--color-text-primary);
          line-height: 1;
        }

        .time-unit {
          font-size: var(--text-sm);
          color: var(--color-text-tertiary);
          margin-top: var(--space-1);
        }

        .goal-info {
          display: flex;
          align-items: center;
          gap: var(--space-1);
          background: none;
          border: none;
          color: var(--color-text-secondary);
          font-size: var(--text-sm);
          cursor: pointer;
          padding: var(--space-2);
          border-radius: var(--radius-md);
          transition: all 0.2s;
        }

        .goal-info:hover {
          color: var(--color-accent);
          background: var(--color-bg-tertiary);
        }

        .keep-reading-btn {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          width: 100%;
          max-width: 280px;
          padding: var(--space-4);
          background: var(--color-bg-elevated);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          cursor: pointer;
          transition: all 0.2s;
          color: var(--color-text-primary);
        }

        .keep-reading-btn:hover {
          background: var(--color-bg-tertiary);
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
        }

        .btn-text {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          flex: 1;
          text-align: left;
        }

        .btn-title {
          font-weight: 600;
          font-size: var(--text-base);
        }

        .btn-subtitle {
          font-size: var(--text-xs);
          color: var(--color-text-secondary);
          max-width: 180px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        @media (max-width: 768px) {
          .today-progress {
            gap: var(--space-4);
          }

          .ring-container svg {
            width: 140px;
            height: 140px;
          }

          .time-value {
            font-size: 36px;
          }

          .keep-reading-btn {
            max-width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
