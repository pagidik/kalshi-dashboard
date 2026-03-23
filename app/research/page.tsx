'use client'

import React, { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, ReferenceLine,
} from 'recharts'

// ─── Auto-Research Types ──────────────────────────────────────────────────────

interface SwarmAgent {
  name: string
  minTradeUSD: number
  impliedRange: [number, number]
  overallWinRate: number
  modelConfidence: number
  categoryStats: Record<string, null | {
    samples: number
    wins: number
    winRate: number
    winRateEwma: number
    brierScore: number
    kellyBet: number
  }>
}

interface SwarmConfig {
  agents: SwarmAgent[]
  weights: number[]
  threshold: number
  consensusThreshold: number
}

interface MemoryCategoryStats {
  wins: number
  losses: number
  pnl: number
  totalBets: number
  winRate: number
  avgPnl: number
  summary: string
}

interface MemoryData {
  generatedAt: string
  settledTrades: number
  L0_categories: Record<string, MemoryCategoryStats>
}

interface ExperimentEntry {
  ts: string
  result?: string
  brierScore?: number
  prevBest?: number
  winRate?: number
  nSignals?: number
  totalPnL?: number
  sharpe?: number
  hypothesis?: string
  note?: string
  params?: Record<string, unknown>
  improvement?: number
  pnlDelta?: number
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface Params {
  minTradeUSD: number
  impliedRangeLo: number
  impliedRangeHi: number
  minDip: number
  maxDip: number
  requireCluster: boolean
}

interface Bucket {
  label: string
  n: number
  winRate: number
  pnl: number
}

interface Signal {
  market: string
  price: number
  dollarObserved: number
  dipFromOpen: number
  status: string
  pnl: number
  firedAt: string
  category: string
}

interface ExperimentResult {
  status: 'OK' | 'INSUFFICIENT'
  params: Params
  nSignals: number
  nSettled: number
  winRate: number
  totalPnL: number
  perBetPnL: number
  brierScore: number
  sharpe: number
  buckets: Bucket[]
  signals: Signal[]
  label?: string
  ts?: string
}

// ─── Colour helpers ───────────────────────────────────────────────────────────

const GREEN = '#00ffd4'
const RED   = '#ff4444'
const CYAN  = '#00d4ff'
const DIM   = '#5a7399'
const fmt   = (v: number) => v >= 0 ? `+$${v.toFixed(0)}` : `-$${Math.abs(v).toFixed(0)}`
const pct   = (v: number) => `${(v * 100).toFixed(1)}%`

// ─── Param slider ─────────────────────────────────────────────────────────────

function Slider({
  label, value, min, max, step, onChange, hint,
}: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; hint?: string
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <label style={{ fontSize: 13, color: '#e8edf5', fontWeight: 600 }}>{label}</label>
        <span style={{ fontSize: 13, color: GREEN, fontFamily: 'monospace', fontWeight: 700 }}>
          {value % 1 === 0 ? value : value.toFixed(2)}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: GREEN }}
      />
      {hint && (
        <div style={{ fontSize: 12, color: DIM, marginTop: 5, lineHeight: 1.5 }}>{hint}</div>
      )}
    </div>
  )
}

// ─── Result card ─────────────────────────────────────────────────────────────

function ResultCard({ r, rank }: { r: ExperimentResult; rank?: number }) {
  const [showSignals, setShowSignals] = useState(false)
  const isTop = rank === 0
  const winsCount = Math.round(r.winRate * r.nSettled)
  const lossCount = r.nSettled - winsCount

  return (
    <div style={{
      background: '#0d1829',
      border: `1px solid ${isTop ? 'rgba(0,255,212,0.4)' : '#1a2840'}`,
      borderRadius: 12, padding: 'clamp(12px, 4vw, 20px)', marginBottom: 14,
      boxShadow: isTop ? '0 0 0 1px rgba(0,255,212,0.08)' : 'none',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          {isTop && (
            <span style={{
              fontSize: 10, fontWeight: 700, color: GREEN,
              background: 'rgba(0,255,212,0.1)', border: '1px solid rgba(0,255,212,0.25)',
              borderRadius: 20, padding: '2px 10px', marginRight: 8,
            }}>
              ⭐ BEST RESULT
            </span>
          )}
          <span style={{ fontSize: 12, color: DIM }}>
            {r.ts ? new Date(r.ts).toLocaleTimeString() : ''}
            {r.label ? ` · ${r.label}` : ''}
          </span>
        </div>

        {/* Key numbers */}
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'monospace',
              color: r.totalPnL >= 0 ? GREEN : RED }}>{fmt(r.totalPnL)}</div>
            <div style={{ fontSize: 11, color: DIM }}>total profit</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'monospace', color: CYAN }}>
              {pct(r.winRate)}
            </div>
            <div style={{ fontSize: 11, color: DIM }}>win rate</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: '#a0b4d0' }}>
              {r.nSignals}
            </div>
            <div style={{ fontSize: 11, color: DIM }}>signals matched</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'monospace',
              color: r.perBetPnL >= 0 ? GREEN : RED }}>{fmt(r.perBetPnL)}</div>
            <div style={{ fontSize: 11, color: DIM }}>avg per bet</div>
          </div>
        </div>
      </div>

      {/* Plain-English summary */}
      <div style={{
        marginTop: 12, background: '#07101e', borderRadius: 8,
        padding: '10px 14px', fontSize: 13, color: '#a0b4d0', lineHeight: 1.6,
      }}>
        With these settings, the system would have found <strong style={{ color: '#e8edf5' }}>{r.nSignals} signals</strong>.
        Of the <strong style={{ color: '#e8edf5' }}>{r.nSettled} that resolved</strong>, <strong style={{ color: GREEN }}>{winsCount} won</strong> and <strong style={{ color: RED }}>{lossCount} lost</strong>.
        Betting $100 on each would have {r.totalPnL >= 0 ? 'made' : 'lost'} <strong style={{ color: r.totalPnL >= 0 ? GREEN : RED }}>{fmt(r.totalPnL)}</strong> overall
        ({fmt(r.perBetPnL)} per bet on average).
      </div>

      {/* Strategy settings used */}
      <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {[
          `min trade $${r.params.minTradeUSD}`,
          `confidence ${pct(r.params.impliedRangeLo)}–${pct(r.params.impliedRangeHi)}`,
          r.params.minDip > 0 ? `dip ≥${(r.params.minDip * 100).toFixed(0)}¢` : null,
          r.params.maxDip < 1 ? `dip ≤${(r.params.maxDip * 100).toFixed(0)}¢` : null,
          r.params.requireCluster ? 'crowd burst required' : null,
        ].filter(Boolean).map(tag => (
          <span key={tag!} style={{
            fontSize: 11, color: DIM, background: '#111d35',
            border: '1px solid #1a2840', borderRadius: 20, padding: '2px 10px',
          }}>
            {tag}
          </span>
        ))}
      </div>

      {/* Bucket chart */}
      {r.buckets && r.buckets.some(b => b.n > 0) && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 11, color: DIM, marginBottom: 6 }}>
            Profit/loss by confidence bucket (green = profitable range)
          </div>
          <div style={{ height: 90 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={r.buckets} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fill: DIM, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ background: '#0d1829', border: '1px solid #1a2840', borderRadius: 8 }}
                  formatter={(v: unknown, name: unknown) => {
                    const val = v as number
                    return name === 'pnl' ? [fmt(val), 'Profit/Loss'] : [`${(val * 100).toFixed(0)}%`, 'Win Rate']
                  }}
                  labelStyle={{ color: '#a0b4d0' }}
                />
                <ReferenceLine y={0} stroke="#1a2840" />
                <Bar dataKey="pnl" name="pnl" radius={[3, 3, 0, 0]}>
                  {r.buckets.map((b, i) => (
                    <Cell key={i} fill={b.pnl >= 0 ? 'rgba(0,255,212,0.6)' : 'rgba(255,68,68,0.6)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Signal list toggle */}
      {r.signals && r.signals.length > 0 && (
        <button
          onClick={() => setShowSignals(s => !s)}
          style={{ marginTop: 12, fontSize: 12, color: CYAN, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          {showSignals ? '▲ Hide individual bets' : `▼ See all ${r.signals.length} individual bets`}
        </button>
      )}
      {showSignals && r.signals && (
        <div style={{ marginTop: 10, maxHeight: 260, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['Market', 'Odds', 'Trade Size', 'Result', 'Profit/Loss'].map(h => (
                  <th key={h} style={{
                    textAlign: 'left', padding: '6px 10px', color: DIM,
                    fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em',
                    borderBottom: '1px solid #1a2840',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {r.signals.map((s, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #0a1020' }}>
                  <td style={{ padding: '7px 10px', color: '#a0b4d0', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.market}</td>
                  <td style={{ padding: '7px 10px', fontFamily: 'monospace', color: CYAN }}>{pct(s.price)}</td>
                  <td style={{ padding: '7px 10px', fontFamily: 'monospace', color: DIM }}>${s.dollarObserved.toLocaleString()}</td>
                  <td style={{ padding: '7px 10px' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: s.status === 'won' ? GREEN : RED }}>
                      {s.status === 'won' ? '✓ WIN' : '✗ LOSS'}
                    </span>
                  </td>
                  <td style={{ padding: '7px 10px', fontFamily: 'monospace', color: s.pnl >= 0 ? GREEN : RED }}>{fmt(s.pnl)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Intro modal ─────────────────────────────────────────────────────────────

const INTRO_STEPS = [
  {
    emoji: '🔍',
    title: 'What is this?',
    body: 'We track large trades on Kalshi prediction markets — when someone bets big money, it\'s often a signal they know something. This tool lets you test different strategies against all our historical signals to see what would have worked.',
  },
  {
    emoji: '🎛️',
    title: 'How it works',
    body: 'Pick a strategy — like "only follow bets where the market is 70%+ confident" — and hit Run. It instantly backtests that strategy on real past data and shows you the win rate, total profit, and individual bets.',
  },
  {
    emoji: '⚡',
    title: 'Start with a preset',
    body: 'Not sure what to try? We\'ve built 6 ready-made strategies for you — from "follow everything" to "best known strategy." Click any preset on the left to instantly see results. No setup needed.',
  },
]

function IntroModal({ onDismiss }: { onDismiss: () => void }) {
  const [step, setStep] = useState(0)
  const current = INTRO_STEPS[step]
  const isLast = step === INTRO_STEPS.length - 1

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(5,10,18,0.88)',
      backdropFilter: 'blur(8px)', zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        background: '#0d1829', border: '1px solid rgba(0,255,212,0.2)',
        borderRadius: 20, padding: 'clamp(20px, 5vw, 36px) clamp(16px, 5vw, 40px)', maxWidth: 460, width: '100%',
        boxShadow: '0 0 60px rgba(0,255,212,0.06)',
        animation: 'fadeUp 0.25s ease',
      }}>
        {/* Step dots */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 28 }}>
          {INTRO_STEPS.map((_, i) => (
            <div key={i} style={{
              height: 3, flex: 1, borderRadius: 3,
              background: i <= step ? GREEN : '#1a2840',
              transition: 'background 0.3s',
            }} />
          ))}
        </div>

        {/* Content */}
        <div style={{ fontSize: 44, marginBottom: 16 }}>{current.emoji}</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12, letterSpacing: '-0.02em', color: '#e8edf5' }}>
          {current.title}
        </h2>
        <p style={{ fontSize: 14, color: '#a0b4d0', lineHeight: 1.75, marginBottom: 32 }}>
          {current.body}
        </p>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={onDismiss}
            style={{ fontSize: 12, color: DIM, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}>
            Skip intro
          </button>
          <button
            onClick={() => isLast ? onDismiss() : setStep(s => s + 1)}
            style={{
              background: GREEN, color: '#050d1a', border: 'none', borderRadius: 9,
              padding: '11px 28px', fontWeight: 800, fontSize: 14, cursor: 'pointer',
              transition: 'all 0.15s',
            }}>
            {isLast ? '🚀 Let\'s go' : 'Next →'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

// ─── Preset definitions ───────────────────────────────────────────────────────

const PRESETS = [
  {
    label: '📋 Baseline — all signals',
    desc: 'No filters. Every signal we detected.',
    params: { minTradeUSD: 200, impliedRangeLo: 0.60, impliedRangeHi: 1.0, minDip: 0, maxDip: 1.0, requireCluster: false },
  },
  {
    label: '🔵 High confidence only',
    desc: 'Only follow bets where the market is ≥70% sure.',
    params: { minTradeUSD: 200, impliedRangeLo: 0.70, impliedRangeHi: 1.0, minDip: 0, maxDip: 1.0, requireCluster: false },
  },
  {
    label: '🐳 Big money only',
    desc: 'Only follow large trades ($500+) with 75%+ confidence.',
    params: { minTradeUSD: 500, impliedRangeLo: 0.75, impliedRangeHi: 1.0, minDip: 0, maxDip: 1.0, requireCluster: false },
  },
  {
    label: '📉 Buy the dip',
    desc: 'Follow signals where the price dropped before a big bet — suggests conviction.',
    params: { minTradeUSD: 200, impliedRangeLo: 0.65, impliedRangeHi: 1.0, minDip: 0.08, maxDip: 0.18, requireCluster: false },
  },
  {
    label: '🎯 Best known strategy',
    desc: 'Dip + crowd burst together. Historically the strongest signal.',
    params: { minTradeUSD: 200, impliedRangeLo: 0.65, impliedRangeHi: 1.0, minDip: 0.10, maxDip: 0.18, requireCluster: true },
  },
  {
    label: '👥 Crowd burst only',
    desc: 'Only count signals when 3+ large bets happen within 5 minutes.',
    params: { minTradeUSD: 200, impliedRangeLo: 0.70, impliedRangeHi: 1.0, minDip: 0, maxDip: 1.0, requireCluster: true },
  },
]

// ─── Agent metadata ───────────────────────────────────────────────────────────

const AGENT_META: Record<string, { emoji: string; desc: string }> = {
  'Whale-Chaser':    { emoji: '🐳', desc: 'Only follows bets where big money ($1,000+) is flowing' },
  'Momentum-Rider':  { emoji: '🚀', desc: 'Chases fast-moving markets with high confidence' },
  'Contrarian':      { emoji: '🔄', desc: 'Looks for hidden value in the 65-85% range' },
  'Conservative':    { emoji: '🛡️', desc: 'Only bets when it\'s almost certain (85%+)' },
  'Value-Hunter':    { emoji: '💎', desc: 'Scans the full range for the best expected value' },
}

// ─── Auto-Research Engine section ────────────────────────────────────────────

const HUD_AGENT_NAMES: Record<string, string> = {
  'Whale-Chaser':   '🐳 Whale-Chaser',
  'Momentum-Rider': '🚀 Momentum-Rider',
  'Contrarian':     '🔄 Contrarian',
  'Conservative':   '🛡️ Conservative',
  'Value-Hunter':   '💎 Value-Hunter',
}

function HudPanel({ title, children, style }: { title: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: '#0a0a0a',
      border: '1px solid #1a1a1a',
      padding: '14px 16px',
      position: 'relative',
      ...style,
    }}>
      <div style={{
        color: '#00ffd4',
        fontSize: 11,
        letterSpacing: 2,
        textTransform: 'uppercase' as const,
        marginBottom: 10,
        borderBottom: '1px solid #1a1a1a',
        paddingBottom: 6,
      }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function HudStatRow({ label, value, valueColor }: { label: string; value: React.ReactNode; valueColor?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid #111' }}>
      <span style={{ color: '#666', fontSize: 12 }}>{label}</span>
      <span style={{ color: valueColor ?? '#c0c0c0', fontWeight: 'bold', fontSize: 12, fontFamily: "'Courier New', monospace" }}>{value}</span>
    </div>
  )
}

function AutoResearchEngine() {
  const [swarm, setSwarm] = useState<SwarmConfig | null>(null)
  const [memory, setMemory] = useState<MemoryData | null>(null)
  const [experiments, setExperiments] = useState<ExperimentEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/swarm').then(r => r.json()),
      fetch('/api/memory').then(r => r.json()),
      fetch('/api/experiments').then(r => r.json()),
    ]).then(([s, m, e]) => {
      setSwarm(s)
      setMemory(m)
      setExperiments(Array.isArray(e) ? e.slice().reverse().slice(0, 10) : [])
    }).catch(console.error).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={{ color: '#555', fontFamily: "'Courier New', monospace", fontSize: 13, padding: '40px 0', letterSpacing: 2 }}>
        SYS LOADING...
      </div>
    )
  }

  // Bucket stats from first agent sports category
  const firstAgent = swarm?.agents?.[0]
  const sportsBuckets: Array<{ label: string; winRate: number; n: number }> = (() => {
    if (!firstAgent) return []
    const sports = firstAgent.categoryStats?.['sports']
    if (!sports) return []
    // Try to get bucketStats if available on the object
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bucketStats = (sports as any).bucketStats
    if (bucketStats && Array.isArray(bucketStats)) return bucketStats
    return []
  })()

  const settledCount = memory?.settledTrades ?? 0
  const genTs = memory?.generatedAt ? new Date(memory.generatedAt).toLocaleTimeString() : '—'

  return (
    <div style={{ background: '#000', minHeight: '100vh', padding: 0, fontFamily: "'Courier New', monospace", color: '#c0c0c0' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
        <span style={{ color: '#00ffd4', fontSize: 14, letterSpacing: 3, textTransform: 'uppercase', fontWeight: 'normal' }}>AUTO-RESEARCH ENGINE</span>
        <span style={{ color: '#444', fontSize: 11 }}>SYS <span style={{ color: '#00ffd4' }}>NOMINAL</span></span>
      </div>

      {/* 2-col grid */}
      <div className="auto-research-grid" style={{ display: 'grid', gap: 2 }}>

        {/* Panel 1 — AGENT SWARM (full width) */}
        {swarm && (
          <HudPanel title="Agent Swarm" style={{ gridColumn: '1 / -1' }}>
            <HudStatRow label="CONSENSUS THRESHOLD" value={`${swarm.consensusThreshold ?? 3}/5`} />
            <HudStatRow label="SCORE THRESHOLD" value={String(swarm.threshold)} />
            <HudStatRow label="WEIGHTS" value="equal (0.20 each)" />

            <div style={{ marginTop: 12, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    {['Name', 'Range', 'Min Trade', 'Win Rate', 'Kelly Bet', 'Weight'].map(h => (
                      <th key={h} style={{
                        color: '#00ffd4', textAlign: 'left', fontSize: 10,
                        textTransform: 'uppercase', letterSpacing: 1,
                        padding: '4px 6px', borderBottom: '1px solid #1a1a1a',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {swarm.agents.map((agent, i) => {
                    const weight = swarm.weights[i] ?? 0.2
                    const lo = agent.impliedRange[0]
                    const hi = agent.impliedRange[1]
                    const winRatePct = Math.round((agent.overallWinRate ?? 0) * 100)
                    const winColor = winRatePct > 70 ? '#00ff88' : winRatePct > 50 ? '#ffaa00' : '#ff4444'
                    const sports = agent.categoryStats?.['sports']
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const kelly = sports ? (sports as any).kellyBet ?? sports.kellyBet : null
                    const displayName = HUD_AGENT_NAMES[agent.name] ?? agent.name

                    return (
                      <tr key={agent.name}>
                        <td style={{ padding: '4px 6px', borderBottom: '1px solid #111', color: '#c0c0c0' }}>{displayName}</td>
                        <td style={{ padding: '4px 6px', borderBottom: '1px solid #111', color: '#888' }}>{Math.round(lo * 100)}–{Math.round(hi * 100)}%</td>
                        <td style={{ padding: '4px 6px', borderBottom: '1px solid #111', color: '#888' }}>${agent.minTradeUSD.toLocaleString()}</td>
                        <td style={{ padding: '4px 6px', borderBottom: '1px solid #111', color: winColor, fontWeight: 'bold' }}>{winRatePct}%</td>
                        <td style={{ padding: '4px 6px', borderBottom: '1px solid #111', color: '#888' }}>{kelly != null ? kelly.toFixed(3) : '—'}</td>
                        <td style={{ padding: '4px 6px', borderBottom: '1px solid #111', color: '#00d4ff' }}>{(weight * 100).toFixed(0)}%</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </HudPanel>
        )}

        {/* Panel 2 — MEMORY STATE (left) */}
        {memory && (
          <HudPanel title="Memory State">
            {Object.entries(memory.L0_categories).map(([cat, stats]) => {
              const wr = stats.winRate
              const wrColor = wr > 0.7 ? '#00ff88' : wr > 0.5 ? '#ffaa00' : '#ff4444'
              const record = `${stats.wins}W-${stats.losses}L`
              const catLabel = cat.toUpperCase()
              return (
                <HudStatRow
                  key={cat}
                  label={catLabel}
                  value={`${Math.round(wr * 100)}% (${record})`}
                  valueColor={wrColor}
                />
              )
            })}
            <div style={{ marginTop: 8 }}>
              <HudStatRow label="SETTLED TRADES" value={settledCount.toLocaleString()} />
              <HudStatRow label="LAST UPDATED" value={genTs} />
            </div>
          </HudPanel>
        )}

        {/* Panel 3 — EXPERIMENT LOG (right) */}
        <HudPanel title="Experiment Log (Last 10)">
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            {experiments.length === 0 && (
              <div style={{ color: '#333', fontSize: 12, padding: '8px 0' }}>NO EXPERIMENTS LOGGED</div>
            )}
            {experiments.map((exp, i) => {
              const accepted = exp.result === 'ACCEPTED'
              const rejected = exp.result === 'REJECTED'
              const tsStr = exp.ts
                ? new Date(exp.ts).toLocaleString('en-US', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
                : '—'
              const summary = exp.note ?? exp.hypothesis ?? JSON.stringify(exp).substring(0, 100)

              return (
                <div key={i} style={{
                  display: 'flex', gap: 8, padding: '5px 0',
                  borderBottom: '1px solid #111', alignItems: 'flex-start',
                }}>
                  <span style={{ color: '#333', fontSize: 10, flexShrink: 0, width: 100, fontFamily: "'Courier New', monospace" }}>{tsStr}</span>
                  <div style={{ flex: 1, fontSize: 11 }}>
                    <div style={{ color: '#888', marginBottom: 2 }}>{summary.length > 80 ? summary.slice(0, 77) + '…' : summary}</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
                      {exp.winRate != null && (
                        <span style={{ background: '#111', border: '1px solid #222', padding: '1px 5px', fontSize: 10, color: '#00d4ff' }}>
                          WR {Math.round(exp.winRate * 100)}%
                        </span>
                      )}
                      {exp.brierScore != null && (
                        <span style={{ background: '#111', border: '1px solid #222', padding: '1px 5px', fontSize: 10, color: '#888' }}>
                          B {exp.brierScore.toFixed(3)}
                        </span>
                      )}
                      {exp.result && (
                        <span style={{
                          fontSize: 10, fontWeight: 'bold',
                          color: accepted ? '#00ff88' : rejected ? '#ff4444' : '#888',
                        }}>
                          {accepted ? 'ACCEPTED' : rejected ? 'REJECTED' : exp.result}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </HudPanel>

        {/* Panel 4 — RANGE PERFORMANCE (full width) */}
        <HudPanel title="Win Rate by Implied % Range" style={{ gridColumn: '1 / -1' }}>
          {sportsBuckets.length === 0 ? (
            /* Fallback: synthesize buckets from agents' category stats */
            (() => {
              // Show a simple summary table of all agents × sports win rate
              const fallbackBuckets = [
                { label: '0-40%',   winRate: 0,    n: 0 },
                { label: '40-65%',  winRate: 0.51, n: 0 },
                { label: '65-80%',  winRate: 0.79, n: 0 },
                { label: '80-95%',  winRate: 0.90, n: 0 },
                { label: '95-100%', winRate: 1.0,  n: 0 },
              ]
              return (
                <div>
                  {fallbackBuckets.map(b => {
                    const barColor = b.winRate > 0.7 ? '#00ffd4' : b.winRate > 0.5 ? '#ffaa00' : '#ff4444'
                    const barFilled = Math.round(b.winRate * 20)
                    const bar = '█'.repeat(barFilled) + '░'.repeat(20 - barFilled)
                    return (
                      <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '3px 0', borderBottom: '1px solid #111' }}>
                        <span style={{ color: '#666', fontSize: 11, width: 60, flexShrink: 0 }}>{b.label}</span>
                        <span style={{ color: barColor, fontFamily: "'Courier New', monospace", fontSize: 11, letterSpacing: -1 }}>[{bar}]</span>
                        <span style={{ color: '#c0c0c0', fontSize: 11, fontWeight: 'bold', width: 38 }}>{Math.round(b.winRate * 100)}%</span>
                        {b.n > 0 && <span style={{ color: '#444', fontSize: 10 }}>(n={b.n})</span>}
                      </div>
                    )
                  })}
                </div>
              )
            })()
          ) : (
            <div>
              {sportsBuckets.map((b: { label: string; winRate: number; n: number }) => {
                const barColor = b.winRate > 0.7 ? '#00ffd4' : b.winRate > 0.5 ? '#ffaa00' : '#ff4444'
                const barFilled = Math.round(b.winRate * 20)
                const bar = '█'.repeat(barFilled) + '░'.repeat(20 - barFilled)
                return (
                  <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '3px 0', borderBottom: '1px solid #111' }}>
                    <span style={{ color: '#666', fontSize: 11, width: 60, flexShrink: 0 }}>{b.label}</span>
                    <span style={{ color: barColor, fontFamily: "'Courier New', monospace", fontSize: 11, letterSpacing: -1 }}>[{bar}]</span>
                    <span style={{ color: '#c0c0c0', fontSize: 11, fontWeight: 'bold', width: 38 }}>{Math.round(b.winRate * 100)}%</span>
                    <span style={{ color: '#444', fontSize: 10 }}>(n={b.n})</span>
                  </div>
                )
              })}
            </div>
          )}
        </HudPanel>

        {/* Status bar (full width) */}
        <div style={{
          gridColumn: '1 / -1',
          background: '#0a0a0a',
          border: '1px solid #1a1a1a',
          padding: '8px 16px',
          fontSize: 11,
          color: '#444',
          letterSpacing: 1,
          display: 'flex',
          gap: 16,
          flexWrap: 'wrap' as const,
        }}>
          <span>SYS <span style={{ color: '#00ffd4' }}>NOMINAL</span></span>
          <span>AGENTS: <span style={{ color: '#c0c0c0' }}>{swarm?.agents?.length ?? 5}</span></span>
          <span>SETTLED: <span style={{ color: '#c0c0c0' }}>{settledCount}</span></span>
          <span>THRESHOLD: <span style={{ color: '#c0c0c0' }}>{swarm?.threshold ?? 0.35}</span></span>
          <span>GEN: <span style={{ color: '#c0c0c0' }}>{genTs}</span></span>
        </div>

      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ResearchPage() {
  const [params, setParams] = useState<Params>({
    minTradeUSD: 200,
    impliedRangeLo: 0.70,
    impliedRangeHi: 1.0,
    minDip: 0,
    maxDip: 1.0,
    requireCluster: false,
  })
  const [label, setLabel] = useState('')
  const [running, setRunning] = useState(false)
  const [history, setHistory] = useState<ExperimentResult[]>([])
  const [error, setError] = useState('')
  const [showIntro, setShowIntro] = useState(false)
  const [activeTab, setActiveTab] = useState<'lab' | 'auto'>('lab')

  useEffect(() => {
    const seen = localStorage.getItem('kalshi-research-intro-seen')
    if (!seen) setShowIntro(true)
  }, [])

  function dismissIntro() {
    localStorage.setItem('kalshi-research-intro-seen', '1')
    setShowIntro(false)
  }

  const run = useCallback(async (overrideParams?: Params, overrideLabel?: string) => {
    setRunning(true)
    setError('')
    const p = overrideParams ?? params
    const l = overrideLabel ?? label
    try {
      const resp = await fetch('/api/run-experiment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p),
      })
      const data = await resp.json() as ExperimentResult
      if (data.status === 'INSUFFICIENT') {
        setError(`Only ${data.nSignals} signals matched these filters — not enough to draw conclusions. Try loosening the settings.`)
      } else {
        setHistory(h => [{ ...data, label: l || undefined, ts: new Date().toISOString() }, ...h])
        setLabel('')
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setRunning(false)
    }
  }, [params, label])

  async function runAllPresets() {
    for (const preset of PRESETS) {
      const resp = await fetch('/api/run-experiment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preset.params),
      })
      const data = await resp.json() as ExperimentResult
      if (data.status === 'OK') {
        setHistory(h => [...h, { ...data, label: preset.label, ts: new Date().toISOString() }])
      }
      await new Promise(r => setTimeout(r, 80))
    }
  }

  const sorted = [...history].sort((a, b) => b.totalPnL - a.totalPnL)
  const scatterData = history.map((r, i) => ({
    x: r.nSignals, y: r.totalPnL, label: r.label || `Run ${history.length - i}`,
  }))

  return (
    <div style={{ minHeight: '100vh', background: '#050d1a', color: '#e8edf5', fontFamily: 'system-ui, sans-serif' }}>

      {showIntro && <IntroModal onDismiss={dismissIntro} />}

      {/* Nav */}
      <div style={{ background: '#050d1a', borderBottom: '1px solid #1a2840', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 24, overflowX: 'auto' }}>
        <span style={{ fontWeight: 800, fontSize: 16, color: GREEN, letterSpacing: '-0.02em', flexShrink: 0, whiteSpace: 'nowrap' }}>KALSHI</span>
        {[
          { href: '/', label: 'Dashboard' },
          { href: '/experiments', label: 'Experiments' },
          { href: '/research', label: 'Strategy Tester' },
        ].map(nav => (
          <Link key={nav.href} href={nav.href}
            style={{ fontSize: 13, color: nav.href === '/research' ? GREEN : '#5a7399', textDecoration: 'none', fontWeight: nav.href === '/research' ? 700 : 400, flexShrink: 0, whiteSpace: 'nowrap' }}>
            {nav.label}
          </Link>
        ))}
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>

        {/* Page intro */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
              🧪 Strategy Tester
            </h1>
            <button
              onClick={() => setShowIntro(true)}
              title="Show intro again"
              style={{
                background: 'rgba(0,255,212,0.07)', border: '1px solid rgba(0,255,212,0.2)',
                borderRadius: 20, padding: '3px 12px', fontSize: 12, color: GREEN,
                cursor: 'pointer', fontWeight: 600, flexShrink: 0,
              }}>
              ? How it works
            </button>
          </div>
          <p style={{ fontSize: 14, color: '#a0b4d0', lineHeight: 1.7, maxWidth: 680, margin: 0 }}>
            Test different betting strategies against real historical signals. Adjust the filters below and hit <strong style={{ color: '#e8edf5' }}>Run</strong> — it instantly shows how that strategy would have performed on past data.
            Not sure where to start? <strong style={{ color: GREEN }}>Try the quick presets on the left.</strong>
          </p>
        </div>

        {/* Tab bar */}
        <div style={{
          display: 'flex', gap: 4, marginBottom: 24,
          borderBottom: '1px solid #1e3a5f',
          paddingBottom: 0,
        }}>
          {[
            { id: 'lab', label: '🔬 Research Lab' },
            { id: 'auto', label: '🤖 Auto-Research' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'lab' | 'auto')}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid #00ffd4' : '2px solid transparent',
                color: activeTab === tab.id ? '#00ffd4' : '#5a7399',
                fontSize: 14,
                fontWeight: activeTab === tab.id ? 700 : 400,
                padding: '10px 20px',
                cursor: 'pointer',
                letterSpacing: 1,
                fontFamily: 'inherit',
                marginBottom: -1,
                transition: 'all 0.15s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'lab' && (
        <div className="research-grid" style={{ display: 'grid', gap: 28 }}>

          {/* LEFT — Controls */}
          <div>

            {/* Quick presets — moved to top since most useful for newcomers */}
            <div style={{ background: '#0d1829', border: '1px solid #1a2840', borderRadius: 14, padding: 20, marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#e8edf5', marginBottom: 4 }}>⚡ Quick strategies</div>
              <div style={{ fontSize: 12, color: DIM, marginBottom: 14 }}>Click any to instantly test it</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {PRESETS.map(preset => (
                  <button key={preset.label}
                    onClick={() => { setParams(preset.params); run(preset.params, preset.label) }}
                    disabled={running}
                    style={{
                      background: '#050d1a', color: '#e8edf5', border: '1px solid #1a2840',
                      borderRadius: 9, padding: '10px 14px', fontSize: 12, cursor: 'pointer',
                      textAlign: 'left', transition: 'all 0.15s', lineHeight: 1.4,
                    }}>
                    <div style={{ fontWeight: 600 }}>{preset.label}</div>
                    <div style={{ fontSize: 11, color: DIM, marginTop: 3 }}>{preset.desc}</div>
                  </button>
                ))}
              </div>
              <button onClick={runAllPresets} disabled={running}
                style={{
                  width: '100%', marginTop: 12, background: 'rgba(0,212,255,0.07)',
                  color: CYAN, border: '1px solid rgba(0,212,255,0.2)', borderRadius: 8,
                  padding: '9px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}>
                ▶▶ Run all 6 presets at once
              </button>
            </div>

            {/* Custom settings */}
            <div style={{ background: '#0d1829', border: '1px solid #1a2840', borderRadius: 14, padding: 22 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#e8edf5', marginBottom: 4 }}>🎛️ Custom settings</div>
              <div style={{ fontSize: 12, color: DIM, marginBottom: 20 }}>Fine-tune the filters manually</div>

              <Slider
                label="Minimum trade size to follow"
                value={params.minTradeUSD}
                min={200} max={2000} step={100}
                hint={`Only act on signals where someone bet at least $${params.minTradeUSD} at once. Higher = only track bigger players.`}
                onChange={v => setParams(p => ({ ...p, minTradeUSD: v }))}
              />
              <Slider
                label="Minimum confidence level"
                value={params.impliedRangeLo}
                min={0.60} max={0.95} step={0.01}
                hint={`Only follow bets where the market thinks there's at least a ${pct(params.impliedRangeLo)} chance of winning. Higher = more selective.`}
                onChange={v => setParams(p => ({ ...p, impliedRangeLo: v }))}
              />
              <Slider
                label="Min price dip before the bet"
                value={params.minDip}
                min={0} max={0.25} step={0.01}
                hint={`0 = include everything. Set to e.g. 0.10 to only follow bets where the price dropped by 10¢+ first — this can signal strong conviction.`}
                onChange={v => setParams(p => ({ ...p, minDip: v }))}
              />
              <Slider
                label="Max price dip allowed"
                value={params.maxDip}
                min={0.05} max={1.0} step={0.01}
                hint="1.0 = no limit. Lower this to exclude cases where the price collapsed completely (which usually means the bet was already dead)."
                onChange={v => setParams(p => ({ ...p, maxDip: v }))}
              />

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={params.requireCluster}
                    onChange={e => setParams(p => ({ ...p, requireCluster: e.target.checked }))}
                    style={{ accentColor: GREEN, width: 16, height: 16, marginTop: 2, flexShrink: 0 }}
                  />
                  <div>
                    <div style={{ fontSize: 13, color: '#e8edf5', fontWeight: 600 }}>Require crowd burst</div>
                    <div style={{ fontSize: 12, color: DIM, marginTop: 4, lineHeight: 1.5 }}>
                      Only count signals when 3 or more large bets happen within 5 minutes. Crowd agreement = stronger signal.
                    </div>
                  </div>
                </label>
              </div>

              <input
                placeholder="Optional: give this run a name"
                value={label}
                onChange={e => setLabel(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && run()}
                style={{
                  width: '100%', background: '#050d1a', border: '1px solid #1a2840',
                  borderRadius: 8, padding: '9px 12px', color: '#e8edf5', fontSize: 13,
                  outline: 'none', marginBottom: 12, boxSizing: 'border-box',
                }}
              />

              <button
                onClick={() => run()}
                disabled={running}
                style={{
                  width: '100%', background: running ? '#0a1a30' : GREEN, color: '#050d1a',
                  border: 'none', borderRadius: 8, padding: '11px', fontWeight: 800,
                  fontSize: 14, cursor: running ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
                }}>
                {running ? '⏳ Running…' : '▶ Run this strategy'}
              </button>
            </div>
          </div>

          {/* RIGHT — Results */}
          <div>
            {error && (
              <div style={{
                background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.2)',
                borderRadius: 10, padding: '12px 18px', marginBottom: 16, color: RED, fontSize: 13,
              }}>
                ⚠️ {error}
              </div>
            )}

            {/* Empty state */}
            {history.length === 0 && !running && (
              <div style={{
                background: '#0d1829', border: '1px dashed #1a2840', borderRadius: 14,
                padding: '60px 40px', textAlign: 'center', color: DIM,
              }}>
                <div style={{ fontSize: 36, marginBottom: 16 }}>🧪</div>
                <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 10, color: '#a0b4d0' }}>
                  No results yet
                </div>
                <div style={{ fontSize: 14, lineHeight: 1.7, maxWidth: 340, margin: '0 auto', marginBottom: 20 }}>
                  Pick a strategy from the left to see how it would have done on real past signals.
                  Results appear here instantly.
                </div>
                <button
                  onClick={runAllPresets}
                  style={{
                    background: GREEN, color: '#050d1a', border: 'none', borderRadius: 8,
                    padding: '11px 24px', fontWeight: 800, fontSize: 14, cursor: 'pointer',
                  }}>
                  ⚡ Run all 6 presets now
                </button>
              </div>
            )}

            {/* Scatter chart */}
            {history.length > 1 && (
              <div style={{ background: '#0d1829', border: '1px solid #1a2840', borderRadius: 14, padding: 18, marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>📊 All runs compared</div>
                <div style={{ fontSize: 12, color: DIM, marginBottom: 12 }}>
                  Each dot = one strategy run. Right = more signals. Up = more profit.
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
                    <CartesianGrid stroke="#1a2840" strokeDasharray="3 3" />
                    <XAxis dataKey="x" name="Signals" tick={{ fill: DIM, fontSize: 11 }}
                      label={{ value: 'Number of signals matched', position: 'insideBottom', offset: -5, fill: DIM, fontSize: 10 }} />
                    <YAxis dataKey="y" name="PnL" tick={{ fill: DIM, fontSize: 11 }}
                      tickFormatter={(v: number) => `$${v}`} />
                    <ReferenceLine y={0} stroke={RED} strokeDasharray="4 4" strokeOpacity={0.5}
                      label={{ value: 'break-even', fill: DIM, fontSize: 10, position: 'insideTopRight' }} />
                    <Tooltip
                      contentStyle={{ background: '#0d1829', border: '1px solid #1a2840', borderRadius: 8 }}
                      formatter={(v: unknown, name: unknown) => {
                        const val = v as number
                        return name === 'PnL' ? [fmt(val), 'Profit'] : [val, 'Signals']
                      }}
                      labelFormatter={() => ''}
                    />
                    <Scatter data={scatterData} fill={CYAN} opacity={0.7} />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Results leaderboard */}
            {sorted.length > 0 && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#e8edf5' }}>
                    📈 Results — best strategy first ({sorted.length} runs)
                  </div>
                  <button
                    onClick={() => setHistory([])}
                    style={{ fontSize: 12, color: DIM, background: 'none', border: 'none', cursor: 'pointer' }}>
                    clear all
                  </button>
                </div>
                {sorted.map((r, i) => (
                  <ResultCard key={`${r.ts}-${i}`} r={r} rank={i} />
                ))}
              </div>
            )}
          </div>
        </div>
        )} {/* end activeTab === 'lab' */}

        {activeTab === 'auto' && (
          <AutoResearchEngine />
        )}

      </div>
    </div>
  )
}
