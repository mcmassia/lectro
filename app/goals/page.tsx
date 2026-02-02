'use client';

import { useState } from 'react';
import { TodayProgress } from '@/components/goals/TodayProgress';
import { BooksThisYear } from '@/components/goals/BooksThisYear';
import { StreakCard } from '@/components/goals/StreakCard';
import { TimeChart } from '@/components/goals/TimeChart';
import { GoalEditor } from '@/components/goals/GoalEditor';
import { Settings } from 'lucide-react';

export default function GoalsPage() {
  const [showGoalEditor, setShowGoalEditor] = useState(false);
  const [chartDays, setChartDays] = useState<7 | 30>(7);

  return (
    <div className="goals-page animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Metas de Lectura</h1>
          <p className="page-subtitle">Lee cada día, ve tu progreso y termina más libros</p>
        </div>
        <button className="settings-btn" onClick={() => setShowGoalEditor(true)}>
          <Settings size={20} />
          <span>Ajustar metas</span>
        </button>
      </div>

      <div className="goals-grid">
        {/* Today's Progress */}
        <section className="card today-card">
          <TodayProgress onGoalClick={() => setShowGoalEditor(true)} />
        </section>

        {/* Streak */}
        <section className="card streak-card-section">
          <StreakCard />
        </section>

        {/* Books This Year */}
        <section className="card books-card">
          <BooksThisYear />
        </section>

        {/* Time Chart */}
        <section className="chart-section">
          <div className="chart-header">
            <div className="chart-tabs">
              <button
                className={`tab ${chartDays === 7 ? 'active' : ''}`}
                onClick={() => setChartDays(7)}
              >
                7 días
              </button>
              <button
                className={`tab ${chartDays === 30 ? 'active' : ''}`}
                onClick={() => setChartDays(30)}
              >
                30 días
              </button>
            </div>
          </div>
          <TimeChart days={chartDays} />
        </section>
      </div>

      {/* Goal Editor Modal */}
      <GoalEditor isOpen={showGoalEditor} onClose={() => setShowGoalEditor(false)} />

      <style jsx>{`
        .goals-page {
          padding: var(--space-6);
          max-width: 1200px;
          margin: 0 auto;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: var(--space-8);
          flex-wrap: wrap;
          gap: var(--space-4);
        }

        .page-title {
          font-size: var(--text-2xl);
          font-weight: 700;
          color: var(--color-text-primary);
          margin: 0;
        }

        .page-subtitle {
          font-size: var(--text-base);
          color: var(--color-text-secondary);
          margin: var(--space-1) 0 0;
        }

        .settings-btn {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-3) var(--space-4);
          background: var(--color-bg-elevated);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          color: var(--color-text-secondary);
          font-size: var(--text-sm);
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .settings-btn:hover {
          background: var(--color-bg-tertiary);
          color: var(--color-text-primary);
        }

        .goals-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: var(--space-6);
        }

        .card {
          background: var(--color-bg-elevated);
          border-radius: var(--radius-xl);
          border: 1px solid var(--color-border);
          padding: var(--space-6);
        }

        .today-card {
          grid-column: 1;
          grid-row: 1;
        }

        .streak-card-section {
          grid-column: 2;
          grid-row: 1;
        }

        .books-card {
          grid-column: 1 / -1;
        }

        .chart-section {
          grid-column: 1 / -1;
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }

        .chart-header {
          display: flex;
          justify-content: flex-start;
        }

        .chart-tabs {
          display: flex;
          background: var(--color-bg-tertiary);
          border-radius: var(--radius-md);
          padding: 4px;
        }

        .tab {
          padding: var(--space-2) var(--space-4);
          background: none;
          border: none;
          border-radius: var(--radius-sm);
          color: var(--color-text-secondary);
          font-size: var(--text-sm);
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .tab.active {
          background: var(--color-bg-elevated);
          color: var(--color-text-primary);
          box-shadow: var(--shadow-sm);
        }

        .tab:hover:not(.active) {
          color: var(--color-text-primary);
        }

        @media (max-width: 768px) {
          .goals-page {
            padding: var(--space-4);
          }

          .goals-grid {
            display: flex;
            flex-direction: column;
            gap: var(--space-4);
          }

          .card {
            padding: var(--space-4);
          }

          .today-card {
            order: 1;
          }

          .streak-card-section {
            order: 2;
          }

          .books-card {
            order: 3;
          }

          .chart-section {
            order: 4;
          }

          .page-header {
            flex-direction: column;
            align-items: stretch;
            margin-bottom: var(--space-5);
          }

          .settings-btn {
            justify-content: center;
          }

          .page-title {
            font-size: var(--text-xl);
          }

          .page-subtitle {
            font-size: var(--text-sm);
          }
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .animate-fade-in {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
