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

function kalshiUrl(ticker?: string): string | null {
  if (!ticker) return null
  // Derive series ticker by removing the last hyphen-delimited segment
  // e.g. KXNCAAMBGAME-26MAR12LOUMIA-MIA → KXNCAAMBGAME-26MAR12LOUMIA
  const parts = ticker.split('-')
  if (parts.length < 2) return `https://kalshi.com/markets/${ticker}`
  const series = parts.slice(0, -1).join('-')
  return `https://kalshi.com/markets/${series}`
}

function PendingCard({ p }: { p: Prediction }) {
  const sideColor = p.side === 'YES' ? 'text-green' : 'text-red'
  const bet = 100
  const potentialWin = +(bet * (1 - p.price)).toFixed(2)
  const risk = +(bet * p.price).toFixed(2)
  const url = kalshiUrl(p.ticker)

  const inner = (
    <>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-bold px-2 py-0.5 rounded bg-surface2 ${sideColor}`}>{p.side}</span>
            <span className="text-xs text-text-muted">@{p.impliedPct}% implied</span>
            <span className="ml-auto text-xs text-amber font-medium animate-pulse">● OPEN</span>
          </div>
          <p className="font-semibold text-text">{p.market}</p>
          <p className="text-xs text-text-muted mt-1">
            {formatTime(p.firedAt)} · <span title="Amount a large trader put in — what triggered this signal">${p.dollarObserved.toLocaleString()} spotted by big money</span>
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs">
        <div>
          <span className="text-text-muted">Your risk: </span>
          <span className="text-red font-medium">−${risk}</span>
        </div>
        <div>
          <span className="text-text-muted">To win: </span>
          <span className="text-green font-medium">+${potentialWin}</span>
        </div>
        {url && (
          <span className="ml-auto flex items-center gap-1 text-accent/60 text-xs">
            kalshi.com ↗
          </span>
        )}
      </div>
    </>
  )

  return url ? (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block relative rounded-xl border border-amber/20 bg-amber/[0.04] p-5 hover:border-accent/40 hover:bg-accent/[0.04] transition-all cursor-pointer"
    >
      {inner}
    </a>
  ) : (
    <div className="relative rounded-xl border border-amber/20 bg-amber/[0.04] p-5">
      {inner}
    </div>
  )
}

export default function PredictionTable({ predictions }: { predictions: Prediction[] }) {
  const [tab, setTab] = useState<Tab>('all')
  const pending = predictions.filter(p => p.status === 'pending')

  const filtered = predictions.filter(p => {
    if (tab === 'completed') return p.status === 'won' || p.status === 'lost' || p.status === 'expired'
    if (tab === 'pending') return p.status === 'pending'
    return true
  })

  const completedCount = predictions.filter(p => p.status === 'won' || p.status === 'lost').length

  const tabs: { key: Tab; label: string }[] = [
    { key: 'all', label: `All (${predictions.length})` },
    { key: 'completed', label: `Settled (${completedCount})` },
    { key: 'pending', label: `Pending (${pending.length})` },
  ]

  return (
    <div className="space-y-8">

      {/* ── Open Positions ── */}
      {pending.length > 0 && (
        <div className="rounded-xl border border-border bg-surface p-6 md:p-8">
          <div className="flex items-center gap-3 mb-5">
            <h2 className="text-xl font-semibold text-text">Open Positions</h2>
            <span className="rounded-full bg-amber/15 px-2.5 py-0.5 text-xs font-semibold text-amber">{pending.length} pending</span>
            <Tooltip text="These bets haven't settled yet — the game or event hasn't finished. We're tracking whether they'll win or lose.">
              <span className="text-xs text-text-muted cursor-help border-b border-dashed border-text-muted">What's this?</span>
            </Tooltip>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: '420px' }}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {pending.map(p => <PendingCard key={p.id} p={p} />)}
            </div>
          </div>
        </div>
      )}

      {/* ── All Signals Table ── */}
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

      <div className="overflow-auto" style={{ maxHeight: '520px' }}>
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
                <td className="py-4 pr-4 font-medium text-text">
                  {kalshiUrl(p.ticker) ? (
                    <a
                      href={kalshiUrl(p.ticker)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-accent transition-colors hover:underline decoration-accent/50"
                    >
                      {p.market}
                    </a>
                  ) : p.market}
                </td>
                <td className="py-4 pr-4"><SideBadge side={p.side} pct={p.impliedPct} /></td>
                <td className="py-4 pr-4"><ConfidenceBar pct={p.impliedPct} /></td>
                <td className="py-4 pr-4 text-text-muted">${p.dollarObserved.toLocaleString()}</td>
                <td className="py-4 pr-4 font-medium">
                  {p.pnl !== null && p.status !== 'expired' ? (
                    <span style={{ color: p.pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {p.pnl >= 0 ? '+' : ''}${Math.abs(p.pnl).toFixed(2)}
                    </span>
                  ) : p.status === 'expired' ? (
                    <span className="text-text-muted">—</span>
                  ) : (
                    <span className="text-amber italic text-xs">Waiting...</span>
                  )}
                </td>
                <td className="py-4"><StatusBadge status={p.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    </div>
  )
}
