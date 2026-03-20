'use client'

import { useState } from 'react'
import { Prediction } from '../lib/predictions'
import Tooltip from './Tooltip'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Extract event-level ticker (drop last segment, e.g. team code) */
export function getEventTicker(ticker?: string): string {
  if (!ticker) return '__no_ticker__'
  const parts = ticker.split('-')
  return parts.length > 1 ? parts.slice(0, -1).join('-') : ticker
}

/** Group predictions by their event ticker */
export function groupByEvent(predictions: Prediction[]): Map<string, Prediction[]> {
  const map = new Map<string, Prediction[]>()
  for (const p of predictions) {
    const key = p.ticker ? getEventTicker(p.ticker) : `__market__${p.market}`
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(p)
  }
  return map
}

/** Derive a human-readable event name from the group */
function eventName(preds: Prediction[]): string {
  // Most market names are like "Wright St. at Virginia Winner?" — use the first one
  return preds[0].market
}

/** Batch-level status */
function batchStatus(preds: Prediction[]): 'pending' | 'settled' | 'mixed' {
  const settled = preds.filter(p => p.status === 'won' || p.status === 'lost')
  const pending  = preds.filter(p => p.status === 'pending')
  if (pending.length > 0 && settled.length === 0) return 'pending'
  if (settled.length > 0 && pending.length === 0) return 'settled'
  return 'mixed'
}

/** Auto-generate "why we took this position" copy */
function generateReasoning(preds: Prediction[]): string {
  const count      = preds.length
  const maxDollar  = Math.max(...preds.map(p => p.dollarObserved))
  const yesGroup   = preds.filter(p => p.side === 'YES')
  const noGroup    = preds.filter(p => p.side === 'NO')
  const dominant   = yesGroup.length >= noGroup.length ? yesGroup : noGroup
  const domSide    = yesGroup.length >= noGroup.length ? 'YES' : 'NO'
  const minImp     = Math.min(...dominant.map(p => p.impliedPct))
  const maxImp     = Math.max(...dominant.map(p => p.impliedPct))
  const impRange   = minImp === maxImp ? `${minImp}¢` : `${minImp}–${maxImp}¢`

  let tag = 'Mid-range signal.'
  if (maxImp >= 90)       tag = 'Near-certainty play.'
  else if (maxImp >= 75)  tag = 'Classic momentum play.'
  else if (maxImp >= 60)  tag = 'Moderate-confidence signal.'
  else if (maxImp <= 35)  tag = 'Contrarian / underdog play.'

  return `${count} signal${count > 1 ? 's' : ''} detected big money ($${maxDollar.toLocaleString()}+) flowing ${domSide} at ${impRange} implied. ${tag}`
}

/** Auto-generate post-mortem for settled batches */
function generateAnalysis(preds: Prediction[]): string | null {
  const settled = preds.filter(p => p.status === 'won' || p.status === 'lost')
  if (settled.length === 0) return null

  const wins    = settled.filter(p => p.status === 'won').length
  const losses  = settled.filter(p => p.status === 'lost').length
  const winRate = Math.round((wins / settled.length) * 100)
  const pnl     = settled.reduce((s, p) => s + (p.pnl ?? 0), 0)

  let outcome = `${wins}W / ${losses}L (${winRate}% accuracy).`
  if (pnl > 0)       outcome += ` Net: +$${pnl.toFixed(0)}.`
  else if (pnl < 0)  outcome += ` Net: −$${Math.abs(pnl).toFixed(0)}.`

  let lesson = ''
  if      (winRate === 100 && wins >= 2) lesson = ' Perfect batch — every signal correct.'
  else if (winRate === 0)                lesson = ' All signals wrong — market moved against the thesis.'
  else if (winRate >= 67)                lesson = ' Solid batch — majority correct.'
  else                                   lesson = ' Mixed results — signals were split.'

  return outcome + lesson
}

function formatTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  return isToday
    ? `Today ${time}`
    : `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${time}`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SignalRow({ p }: { p: Prediction }) {
  const sideColor = p.side === 'YES' ? 'text-green' : 'text-red'
  const pnlColor  = (p.pnl ?? 0) >= 0 ? 'var(--green)' : 'var(--red)'

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2 px-3 rounded-lg hover:bg-surface2/50 transition-colors text-sm">
      <span className={`font-bold text-xs px-2 py-0.5 rounded bg-surface2 ${sideColor}`}>{p.side}</span>
      <span className="text-text-muted text-xs">@{p.impliedPct}%</span>
      <span className="flex-1 text-text truncate min-w-0">{p.market}</span>
      <span className="text-text-muted text-xs">${p.dollarObserved.toLocaleString()}</span>
      {p.pnl !== null && p.status !== 'pending' && p.status !== 'expired' ? (
        <span className="text-xs font-semibold" style={{ color: pnlColor }}>
          {p.pnl >= 0 ? '+' : ''}${Math.abs(p.pnl).toFixed(0)}
        </span>
      ) : (
        <span className="text-xs text-amber italic">Open</span>
      )}
    </div>
  )
}

function WinRateBar({ wins, total }: { wins: number; total: number }) {
  if (total === 0) return null
  const pct = Math.round((wins / total) * 100)
  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex-1 h-1.5 rounded-full bg-surface2 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: pct >= 60 ? 'var(--green)' : pct >= 40 ? 'var(--amber)' : 'var(--red)', transition: 'width 0.5s ease-out' }}
        />
      </div>
      <span className="text-xs text-text-muted whitespace-nowrap">{wins}W / {total - wins}L</span>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface EventBatchCardProps {
  eventKey: string
  preds: Prediction[]
  defaultOpen?: boolean
}

function EventBatchCard({ eventKey, preds, defaultOpen = false }: EventBatchCardProps) {
  const [open, setOpen] = useState(defaultOpen)

  const status     = batchStatus(preds)
  const settled    = preds.filter(p => p.status === 'won' || p.status === 'lost')
  const wins       = settled.filter(p => p.status === 'won').length
  const pending    = preds.filter(p => p.status === 'pending').length
  const totalPnl   = settled.reduce((s, p) => s + (p.pnl ?? 0), 0)
  const reasoning  = generateReasoning(preds)
  const analysis   = generateAnalysis(preds)
  const name       = eventName(preds)
  const earliest   = preds.reduce((a, b) => a.firedAt < b.firedAt ? a : b)

  // Border / accent colors by status
  const borderCls = status === 'pending'
    ? 'border-amber/25'
    : totalPnl > 0 ? 'border-green/20' : totalPnl < 0 ? 'border-red/20' : 'border-border'
  const bgCls = status === 'pending'
    ? 'bg-amber/[0.03]'
    : totalPnl > 0 ? 'bg-green/[0.03]' : 'bg-surface'

  return (
    <div className={`rounded-xl border ${borderCls} ${bgCls} overflow-hidden transition-all`}>
      {/* ── Header (always visible) ── */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full text-left p-5 flex items-start gap-4 hover:bg-accent/[0.03] transition-colors"
      >
        {/* Expand chevron */}
        <span className="mt-1 text-text-muted text-xs flex-shrink-0 transition-transform duration-200" style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>

        <div className="flex-1 min-w-0">
          {/* Event name + status pill */}
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="font-semibold text-text truncate">{name}</span>
            {status === 'pending' && (
              <span className="rounded-full bg-amber/15 px-2 py-0.5 text-[10px] font-semibold text-amber flex-shrink-0">
                ● {pending} pending
              </span>
            )}
            {status === 'settled' && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold flex-shrink-0 ${totalPnl >= 0 ? 'bg-green/15 text-green' : 'bg-red/15 text-red'}`}>
                {totalPnl >= 0 ? `✓ +$${totalPnl.toFixed(0)}` : `✗ -$${Math.abs(totalPnl).toFixed(0)}`}
              </span>
            )}
            {status === 'mixed' && (
              <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent flex-shrink-0">
                mixed
              </span>
            )}
          </div>

          {/* Stats row */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted mb-2">
            <span>{preds.length} signal{preds.length > 1 ? 's' : ''}</span>
            <span>{formatTime(earliest.firedAt)}</span>
            {settled.length > 0 && <span>{wins}/{settled.length} correct</span>}
            {status === 'pending' && (
              <span className="text-amber">
                Risk: ${preds.filter(p => p.status === 'pending').reduce((s, p) => s + Math.round(p.price * 100), 0)} / Reward: ${preds.filter(p => p.status === 'pending').reduce((s, p) => s + Math.round((1 - p.price) * 100), 0)}
              </span>
            )}
          </div>

          {/* Win-rate progress bar (settled batches) */}
          {settled.length > 0 && <WinRateBar wins={wins} total={settled.length} />}
        </div>

        {/* P&L badge (large, right side) */}
        {settled.length > 0 && (
          <div className="flex-shrink-0 text-right">
            <span className="text-lg font-bold" style={{ color: totalPnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {totalPnl >= 0 ? '+' : '−'}${Math.abs(totalPnl).toFixed(0)}
            </span>
            <div className="text-[10px] text-text-muted">P&amp;L</div>
          </div>
        )}
      </button>

      {/* ── Expanded content ── */}
      {open && (
        <div className="border-t border-border/50 px-5 pb-5 pt-4 space-y-4">
          {/* Reasoning */}
          <div className="rounded-lg bg-surface2/60 px-4 py-3">
            <p className="text-[10px] uppercase tracking-wider text-text-muted font-semibold mb-1">📊 Why we took this position</p>
            <p className="text-sm text-text leading-relaxed">{reasoning}</p>
          </div>

          {/* Analysis (settled only) */}
          {analysis && (
            <div className="rounded-lg bg-surface2/40 border border-border/50 px-4 py-3">
              <p className="text-[10px] uppercase tracking-wider text-text-muted font-semibold mb-1">🔍 Post-Mortem</p>
              <p className="text-sm text-text leading-relaxed">{analysis}</p>
              {preds[0].note && (
                <p className="text-xs text-text-muted mt-2 italic">"{preds[0].note}"</p>
              )}
            </div>
          )}

          {/* Individual signals */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-text-muted font-semibold mb-2">Signals in this batch</p>
            <div className="divide-y divide-border/30">
              {preds.map(p => <SignalRow key={p.id} p={p} />)}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Exported View ────────────────────────────────────────────────────────────

export default function EventBatchGroup({ predictions }: { predictions: Prediction[] }) {
  const grouped = groupByEvent(predictions)

  // Sort: pending first, then by date descending
  const sorted = Array.from(grouped.entries()).sort(([, a], [, b]) => {
    const aHasPending = a.some(p => p.status === 'pending') ? 1 : 0
    const bHasPending = b.some(p => p.status === 'pending') ? 1 : 0
    if (bHasPending !== aHasPending) return bHasPending - aHasPending
    const aDate = Math.max(...a.map(p => new Date(p.firedAt).getTime()))
    const bDate = Math.max(...b.map(p => new Date(p.firedAt).getTime()))
    return bDate - aDate
  })

  return (
    <div className="space-y-3">
      {sorted.map(([key, preds]) => (
        <EventBatchCard
          key={key}
          eventKey={key}
          preds={preds}
          defaultOpen={preds.some(p => p.status === 'pending')}
        />
      ))}
    </div>
  )
}
