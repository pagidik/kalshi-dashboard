'use client'

import { useState } from 'react'
import { Prediction } from '../lib/predictions'
import Tooltip from './Tooltip'

type Tab = 'all' | 'completed' | 'pending'
type ViewMode = 'grouped' | 'individual'

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  return isToday ? `Today ${time}` : `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${time}`
}

function extractEventKey(p: Prediction): string {
  if (p.ticker) {
    const parts = p.ticker.split('-')
    if (parts.length > 1) return parts.slice(0, -1).join('-')
    return p.ticker
  }
  // Fallback: group by market name
  return p.market
}

function kalshiUrl(ticker?: string): string | null {
  if (!ticker) return null
  const parts = ticker.split('-')
  if (parts.length < 2) return `https://kalshi.com/browse?q=${encodeURIComponent(ticker)}`
  const eventTicker = parts.slice(0, -1).join('-').toLowerCase()
  return `https://kalshi.com/browse?q=${encodeURIComponent(eventTicker)}`
}

// ─── Batch Logic ─────────────────────────────────────────────────────────────

interface BatchGroup {
  key: string
  eventName: string
  predictions: Prediction[]
  totalPnl: number
  wins: number
  losses: number
  settled: number
  pending: number
  winRate: number
  isAllSettled: boolean
  isAllPending: boolean
  dominantSide: 'YES' | 'NO' | 'Mixed'
  avgImplied: number
  totalDollar: number
}

function buildBatchGroups(predictions: Prediction[]): BatchGroup[] {
  const map = new Map<string, Prediction[]>()

  for (const p of predictions) {
    const key = extractEventKey(p)
    const existing = map.get(key)
    if (existing) {
      existing.push(p)
    } else {
      map.set(key, [p])
    }
  }

  const groups: BatchGroup[] = []
  for (const [key, preds] of map.entries()) {
    const wins = preds.filter(p => p.status === 'won').length
    const losses = preds.filter(p => p.status === 'lost').length
    const pending = preds.filter(p => p.status === 'pending').length
    const settled = preds.filter(p => p.status === 'won' || p.status === 'lost').length
    const totalPnl = preds.reduce((sum, p) => sum + (p.pnl ?? 0), 0)
    const winRate = settled > 0 ? wins / settled : 0

    const yesSigs = preds.filter(p => p.side === 'YES').length
    const noSigs = preds.filter(p => p.side === 'NO').length
    const dominantSide: 'YES' | 'NO' | 'Mixed' =
      yesSigs > noSigs ? 'YES' : noSigs > yesSigs ? 'NO' : 'Mixed'

    const avgImplied = Math.round(
      preds.reduce((sum, p) => sum + p.impliedPct, 0) / preds.length
    )
    const totalDollar = preds.reduce((sum, p) => sum + p.dollarObserved, 0)

    // Use first prediction's market as event name
    const eventName = preds[0].market

    groups.push({
      key,
      eventName,
      predictions: preds,
      totalPnl,
      wins,
      losses,
      settled,
      pending,
      winRate,
      isAllSettled: pending === 0,
      isAllPending: settled === 0,
      dominantSide,
      avgImplied,
      totalDollar,
    })
  }

  // Sort: groups with pending first, then by totalPnl desc
  return groups.sort((a, b) => {
    if (a.pending > 0 && b.pending === 0) return -1
    if (b.pending > 0 && a.pending === 0) return 1
    return b.totalPnl - a.totalPnl
  })
}

function buildReasoningText(batch: BatchGroup): string {
  const signalWord = batch.predictions.length === 1 ? 'signal' : 'signals'
  const sideLabel = batch.dominantSide === 'Mixed' ? 'both sides' : `${batch.dominantSide} side`
  const conviction =
    batch.avgImplied >= 85
      ? 'High-conviction momentum play.'
      : batch.avgImplied >= 65
      ? 'Moderate conviction. Worth tracking.'
      : 'Low-confidence signal. Approach with caution.'
  return `${batch.predictions.length} ${signalWord} detected $${batch.totalDollar.toLocaleString()} flowing to ${sideLabel} at avg ${batch.avgImplied}% implied. ${conviction}`
}

function buildAnalysisText(batch: BatchGroup): string | null {
  if (!batch.isAllSettled || batch.settled === 0) return null
  const pnlStr = batch.totalPnl >= 0 ? `+$${batch.totalPnl.toFixed(2)}` : `-$${Math.abs(batch.totalPnl).toFixed(2)}`
  const profitable = batch.totalPnl >= 0
  const winRatePct = Math.round(batch.winRate * 100)
  const suffix = profitable
    ? 'High implied % signals continue to outperform.'
    : 'Signal strength did not translate this time.'
  return `Batch ${profitable ? 'won' : 'lost'} ${batch.wins}/${batch.settled} (${pnlStr}). ${winRatePct}% hit rate. ${suffix}`
}

// ─── Small Sub-components ────────────────────────────────────────────────────

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

// ─── Pending Card ─────────────────────────────────────────────────────────────

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

// ─── Batch Card ───────────────────────────────────────────────────────────────

function BatchCard({ batch }: { batch: BatchGroup }) {
  const [expanded, setExpanded] = useState(false)

  const pnlColor = batch.totalPnl > 0 ? 'text-green' : batch.totalPnl < 0 ? 'text-red' : 'text-text-muted'
  const pnlStr =
    batch.totalPnl === 0
      ? '$0.00'
      : batch.totalPnl > 0
      ? `+$${batch.totalPnl.toFixed(2)}`
      : `-$${Math.abs(batch.totalPnl).toFixed(2)}`

  const winRatePct = Math.round(batch.winRate * 100)

  const borderColor = batch.isAllPending
    ? 'border-amber/20'
    : batch.totalPnl > 0
    ? 'border-green/20'
    : batch.totalPnl < 0
    ? 'border-red/20'
    : 'border-border'

  const reasoning = buildReasoningText(batch)
  const analysis = buildAnalysisText(batch)

  return (
    <div className={`rounded-xl border ${borderColor} bg-surface2/40 overflow-hidden transition-all`}>
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full text-left p-4 sm:p-5 hover:bg-accent/[0.03] transition-colors"
      >
        <div className="flex items-start gap-3">
          {/* Expand indicator */}
          <span className="mt-0.5 text-text-muted text-xs select-none transition-transform duration-200"
            style={{ display: 'inline-block', transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
            ▶
          </span>

          <div className="flex-1 min-w-0">
            {/* Top row: event name + badges */}
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="font-semibold text-text text-sm sm:text-base truncate">
                {batch.eventName}
              </span>
              <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent">
                {batch.predictions.length} signal{batch.predictions.length !== 1 ? 's' : ''}
              </span>
              {batch.isAllPending && (
                <span className="rounded-full bg-amber/15 px-2 py-0.5 text-xs font-medium text-amber animate-pulse">
                  ● OPEN
                </span>
              )}
              {batch.isAllSettled && batch.settled > 0 && (
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${batch.totalPnl >= 0 ? 'bg-green/15 text-green' : 'bg-red/15 text-red'}`}>
                  {batch.totalPnl >= 0 ? '✓ Profitable' : '✗ Loss'}
                </span>
              )}
            </div>

            {/* Stats row */}
            <div className="flex flex-wrap items-center gap-4 text-xs">
              {/* Aggregate P&L */}
              <div>
                <span className="text-text-muted">P&L: </span>
                <span className={`font-semibold ${pnlColor}`}>{pnlStr}</span>
              </div>

              {/* Win/Loss */}
              {batch.settled > 0 && (
                <div>
                  <span className="text-text-muted">W/L: </span>
                  <span className="text-green font-medium">{batch.wins}</span>
                  <span className="text-text-muted">/</span>
                  <span className="text-red font-medium">{batch.losses}</span>
                </div>
              )}

              {/* Pending count */}
              {batch.pending > 0 && (
                <div>
                  <span className="text-text-muted">Pending: </span>
                  <span className="text-amber font-medium">{batch.pending}</span>
                </div>
              )}

              {/* Dominant side */}
              <div>
                <span className="text-text-muted">Flow: </span>
                <span className={`font-medium ${
                  batch.dominantSide === 'YES' ? 'text-green'
                  : batch.dominantSide === 'NO' ? 'text-red'
                  : 'text-text-muted'
                }`}>
                  {batch.dominantSide}
                </span>
              </div>

              {/* Avg implied */}
              <div>
                <span className="text-text-muted">Avg: </span>
                <span className="text-text font-medium">{batch.avgImplied}%</span>
              </div>
            </div>

            {/* Win rate progress bar (only if there are settled bets) */}
            {batch.settled > 0 && (
              <div className="mt-3 flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-surface overflow-hidden">
                  <div
                    className="h-full rounded-full bg-green transition-all duration-700"
                    style={{ width: `${winRatePct}%` }}
                  />
                </div>
                <span className="text-xs text-text-muted w-10 text-right">{winRatePct}% win</span>
              </div>
            )}

            {/* Reasoning text */}
            <p className="mt-2 text-xs text-text-muted italic leading-relaxed">
              {reasoning}
            </p>

            {/* Analysis text (settled batches only) */}
            {analysis && (
              <p className="mt-1 text-xs text-accent/80 leading-relaxed">
                {analysis}
              </p>
            )}
          </div>
        </div>
      </button>

      {/* Expanded: individual predictions */}
      {expanded && (
        <div className="border-t border-border/50 px-4 sm:px-5 pb-4">
          <div className="overflow-auto">
            <table className="w-full text-left text-xs mt-3">
              <thead>
                <tr className="border-b border-border/50 text-text-muted uppercase tracking-wider">
                  <th className="pb-2 pr-3 font-medium">When</th>
                  <th className="pb-2 pr-3 font-medium">Market</th>
                  <th className="pb-2 pr-3 font-medium">Signal</th>
                  <th className="pb-2 pr-3 font-medium hidden sm:table-cell">$ Spotted</th>
                  <th className="pb-2 pr-3 font-medium">P&L</th>
                  <th className="pb-2 font-medium">Result</th>
                </tr>
              </thead>
              <tbody>
                {batch.predictions.map(p => (
                  <tr key={p.id} className="border-b border-border/30 hover:bg-accent/[0.02] transition-colors">
                    <td className="py-2.5 pr-3 text-text-muted whitespace-nowrap">{formatTime(p.firedAt)}</td>
                    <td className="py-2.5 pr-3 text-text font-medium">
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
                    <td className="py-2.5 pr-3">
                      <SideBadge side={p.side} pct={p.impliedPct} />
                    </td>
                    <td className="py-2.5 pr-3 text-text-muted hidden sm:table-cell">
                      ${p.dollarObserved.toLocaleString()}
                    </td>
                    <td className="py-2.5 pr-3 font-medium">
                      {p.pnl !== null && p.status !== 'expired' ? (
                        <span style={{ color: p.pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                          {p.pnl >= 0 ? '+' : ''}${Math.abs(p.pnl).toFixed(2)}
                        </span>
                      ) : p.status === 'expired' ? (
                        <span className="text-text-muted">—</span>
                      ) : (
                        <span className="text-amber italic">Waiting…</span>
                      )}
                    </td>
                    <td className="py-2.5">
                      <StatusBadge status={p.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Individual Table Row (used in Individual view) ──────────────────────────

function IndividualTableRows({ predictions }: { predictions: Prediction[] }) {
  return (
    <tbody>
      {predictions.map(p => (
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
  )
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export default function PredictionTable({ predictions }: { predictions: Prediction[] }) {
  const [tab, setTab] = useState<Tab>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('grouped')

  const pending = predictions.filter(p => p.status === 'pending')
  const completedCount = predictions.filter(p => p.status === 'won' || p.status === 'lost').length

  const filtered = predictions.filter(p => {
    if (tab === 'completed') return p.status === 'won' || p.status === 'lost' || p.status === 'expired'
    if (tab === 'pending') return p.status === 'pending'
    return true
  })

  const batchGroups = buildBatchGroups(filtered)

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
          <div className="overflow-y-auto pr-2" style={{ maxHeight: '400px', scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,193,7,0.3) transparent' }}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {pending.map(p => <PendingCard key={p.id} p={p} />)}
            </div>
          </div>
        </div>
      )}

      {/* ── All Signals ── */}
      <div className="rounded-xl border border-border bg-surface p-6 md:p-8">
        <h2 className="text-xl font-semibold text-text">All Signals</h2>
        <p className="mb-4 text-sm text-text-muted">Signals detected from large trades on Kalshi</p>

        {/* Controls row: tabs + view toggle */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          {/* Tab bar */}
          <div className="flex gap-1 rounded-lg bg-surface2 p-1">
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

          {/* View mode toggle */}
          <div className="ml-auto flex gap-1 rounded-lg bg-surface2 p-1">
            <button
              onClick={() => setViewMode('grouped')}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-all flex items-center gap-1.5 ${
                viewMode === 'grouped'
                  ? 'bg-accent/15 text-accent'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              <span>⊞</span>
              <span className="hidden sm:inline">Grouped</span>
            </button>
            <button
              onClick={() => setViewMode('individual')}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-all flex items-center gap-1.5 ${
                viewMode === 'individual'
                  ? 'bg-accent/15 text-accent'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              <span>☰</span>
              <span className="hidden sm:inline">Individual</span>
            </button>
          </div>
        </div>

        {/* ── Grouped View ── */}
        {viewMode === 'grouped' && (
          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,255,212,0.3) transparent' }}>
            {batchGroups.length === 0 ? (
              <p className="text-text-muted text-sm py-8 text-center">No signals match this filter.</p>
            ) : (
              batchGroups.map(batch => (
                <BatchCard key={batch.key} batch={batch} />
              ))
            )}
          </div>
        )}

        {/* ── Individual View ── */}
        {viewMode === 'individual' && (
          <div className="overflow-auto" style={{ maxHeight: '600px', scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,255,212,0.3) transparent' }}>
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
              <IndividualTableRows predictions={filtered} />
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
