'use client'

import { Prediction } from '../lib/predictions'

export default function CategoryCard({ title, predictions }: { title: string; predictions: Prediction[] }) {
  const settled = predictions.filter(p => p.status === 'won' || p.status === 'lost')
  const wins = settled.filter(p => p.status === 'won').length
  const losses = settled.filter(p => p.status === 'lost').length
  const total = settled.length
  const winRate = total > 0 ? (wins / total) * 100 : 0
  const pending = predictions.filter(p => p.status === 'pending').length

  return (
    <div className="rounded-xl border border-border bg-surface p-6 md:p-8">
      <h3 className="mb-4 text-lg font-semibold text-text">{title}</h3>
      <div className="mb-3 flex items-baseline gap-2">
        <span className="text-2xl font-bold text-accent">{winRate.toFixed(0)}%</span>
        <span className="text-sm text-text-muted">win rate</span>
      </div>
      <div className="mb-4 h-2 overflow-hidden rounded-full bg-surface2">
        <div
          className="h-full rounded-full bg-accent transition-all duration-700"
          style={{ width: `${winRate}%` }}
        />
      </div>
      <div className="flex gap-4 text-sm text-text-muted">
        <span className="text-green">{wins}W</span>
        <span className="text-red">{losses}L</span>
        {pending > 0 && <span className="text-amber">{pending} pending</span>}
      </div>
    </div>
  )
}
