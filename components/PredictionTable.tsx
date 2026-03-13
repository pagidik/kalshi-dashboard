'use client'

import { useState } from 'react'
import { Prediction } from '../lib/predictions'
import Tooltip from './Tooltip'

type Tab = 'all' | 'completed' | 'pending'

function formatTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  return isToday ? `Today ${time}` : `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${time}`
}

function StatusBadge({ status }: { status: Prediction['status'] }) {
  const map = {
    won: { label: '✓ Correct', cls: 'bg-green/15 text-green' },
    lost: { label: '✗ Wrong', cls: 'bg-red/15 text-red' },
    pending: { label: '⏳ Pending', cls: 'bg-amber/15 text-amber' },
    expired: { label: '— Expired', cls: 'bg-text-muted/15 text-text-muted' },
  }
  const { label, cls } = map[status]
  return <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${cls}`}>{label}</span>
}

function SideBadge({ side, pct }: { side: 'YES' | 'NO'; pct: number }) {
  const color = side === 'YES' ? 'bg-green/15 text-green' : 'bg-red/15 text-red'
  return (
    <Tooltip text={`The market was saying this outcome had a ${pct}% chance of happening`}>
      <span className="flex items-center gap-2">
        <span className={`inline-block rounded px-2 py-0.5 text-xs font-bold ${color}`}>{side}</span>
        <span className="text-text-muted text-sm">@{pct}%</span>
      </span>
    </Tooltip>
  )
}

function ConfidenceBar({ pct }: { pct: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 rounded-full bg-surface2 overflow-hidden">
        <div
          className="h-full rounded-full bg-accent"
          style={{ width: `${pct}%`, transition: 'width 0.5s ease-out' }}
        />
      </div>
      <span className="text-xs text-text-muted">{pct}%</span>
    </div>
  )
}

export default function PredictionTable({ predictions }: { predictions: Prediction[] }) {
  const [tab, setTab] = useState<Tab>('all')

  const filtered = predictions.filter(p => {
    if (tab === 'completed') return p.status === 'won' || p.status === 'lost' || p.status === 'expired'
    if (tab === 'pending') return p.status === 'pending'
    return true
  })

  const tabs: { key: Tab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'completed', label: 'Completed' },
    { key: 'pending', label: 'Pending' },
  ]

  return (
    <div className="rounded-xl border border-border bg-surface p-6 md:p-8">
      <h2 className="text-xl font-semibold text-text">All Signals</h2>
      <p className="mb-4 text-sm text-text-muted">Signals detected from large trades on Kalshi</p>

      <div className="mb-6 flex gap-1 rounded-lg bg-surface2 p-1 w-fit">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-all ${
              tab === t.key
                ? 'bg-accent/15 text-accent'
                : 'text-text-muted hover:text-text'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wider text-text-muted">
              <th className="pb-3 pr-4 font-medium">When</th>
              <th className="pb-3 pr-4 font-medium">Market</th>
              <th className="pb-3 pr-4 font-medium">Signal</th>
              <th className="pb-3 pr-4 font-medium">Confidence</th>
              <th className="pb-3 pr-4 font-medium">
                <Tooltip text="How much money was placed on this in a single trade — our trigger for tracking it">
                  <span className="cursor-help border-b border-dashed border-text-muted">Money Spotted</span>
                </Tooltip>
              </th>
              <th className="pb-3 pr-4 font-medium">Profit/Loss</th>
              <th className="pb-3 font-medium">Result</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr
                key={p.id}
                className="group border-b border-border/50 transition-all hover:bg-accent/[0.03]"
              >
                <td className="relative py-4 pr-4 text-text-muted whitespace-nowrap">
                  <div className="absolute left-0 top-0 h-full w-0.5 rounded bg-accent opacity-0 transition-opacity group-hover:opacity-100" />
                  {formatTime(p.firedAt)}
                </td>
                <td className="py-4 pr-4 font-medium text-text">{p.market}</td>
                <td className="py-4 pr-4"><SideBadge side={p.side} pct={p.impliedPct} /></td>
                <td className="py-4 pr-4"><ConfidenceBar pct={p.impliedPct} /></td>
                <td className="py-4 pr-4 text-text-muted">${p.dollarObserved.toLocaleString()}</td>
                <td className="py-4 pr-4 font-medium">
                  {p.pnl !== null ? (
                    <span style={{ color: p.pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {p.pnl >= 0 ? '+' : ''}{p.pnl}¢
                    </span>
                  ) : (
                    <span className="text-text-muted italic">Waiting...</span>
                  )}
                </td>
                <td className="py-4"><StatusBadge status={p.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
