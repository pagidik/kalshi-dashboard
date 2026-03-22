'use client'

import { useState, useCallback, useEffect } from 'react'
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
      borderRadius: 12, padding: 20, marginBottom: 14,
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
        borderRadius: 20, padding: '36px 40px', maxWidth: 460, width: '100%',
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
      <div style={{ marginTop: 48, background: '#0d1829', border: '1px solid #1a2840', borderRadius: 16, padding: 32, textAlign: 'center', color: DIM }}>
        <div style={{ fontSize: 28, marginBottom: 12 }}>🤖</div>
        <div style={{ fontSize: 14 }}>Loading Auto-Research Engine…</div>
      </div>
    )
  }

  return (
    <div style={{ marginTop: 56 }}>
      {/* Section header */}
      <div style={{ marginBottom: 28, borderTop: '1px solid #1a2840', paddingTop: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <span style={{ fontSize: 28 }}>🤖</span>
          <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
            Auto-Research Engine
          </h2>
          <span style={{
            fontSize: 10, fontWeight: 700, color: GREEN,
            background: 'rgba(0,255,212,0.1)', border: '1px solid rgba(0,255,212,0.25)',
            borderRadius: 20, padding: '2px 10px',
          }}>LIVE</span>
        </div>
        <p style={{ fontSize: 14, color: '#a0b4d0', maxWidth: 680, margin: 0, lineHeight: 1.7 }}>
          The AI runs 24/7, continuously testing new strategies and updating its own settings.
          Here's a live view of how it thinks, what it's learned, and what it's been experimenting with.
        </p>
      </div>

      {/* Panel 1: How the AI Decides */}
      {swarm && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ background: '#0d1829', border: '1px solid #1a2840', borderRadius: 16, padding: 24 }}>
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 6px 0' }}>🧠 How the AI Decides</h3>
              <p style={{ fontSize: 13, color: '#a0b4d0', margin: 0, lineHeight: 1.6 }}>
                The AI uses 5 independent agents that each look at a market differently. A bet is only placed when at least 3 of them agree — this is called consensus.
              </p>
            </div>

            {/* Agent cards */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: 14,
              marginBottom: 20,
            }}>
              {swarm.agents.map((agent, i) => {
                const meta = AGENT_META[agent.name] ?? { emoji: '🤖', desc: agent.name }
                const weight = swarm.weights[i] ?? 0.2
                const lo = agent.impliedRange[0]
                const hi = agent.impliedRange[1]
                const winRatePct = Math.round((agent.overallWinRate ?? 0) * 100)
                const barLeft = lo * 100
                const barWidth = (hi - lo) * 100

                return (
                  <div key={agent.name} style={{
                    background: '#07101e',
                    border: '1px solid #1a2840',
                    borderRadius: 12,
                    padding: '16px 18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}>
                    {/* Emoji + name + weight badge */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: 28, lineHeight: 1, marginBottom: 4 }}>{meta.emoji}</div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#e8edf5' }}>{agent.name}</div>
                      </div>
                      <span style={{
                        fontSize: 10, fontWeight: 700, color: CYAN,
                        background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)',
                        borderRadius: 20, padding: '2px 8px', whiteSpace: 'nowrap',
                      }}>
                        Weight: {Math.round(weight * 100)}%
                      </span>
                    </div>

                    {/* Description */}
                    <div style={{ fontSize: 12, color: '#8099b8', lineHeight: 1.5 }}>{meta.desc}</div>

                    {/* Win rate */}
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                      <span style={{ fontSize: 28, fontWeight: 800, fontFamily: 'monospace', color: GREEN }}>
                        {winRatePct}%
                      </span>
                      <span style={{ fontSize: 11, color: DIM }}>win rate</span>
                    </div>

                    {/* Implied range bar */}
                    <div>
                      <div style={{ fontSize: 10, color: DIM, marginBottom: 4 }}>
                        Range: {Math.round(lo * 100)}%–{Math.round(hi * 100)}%
                      </div>
                      <div style={{ position: 'relative', height: 6, background: '#1a2840', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{
                          position: 'absolute',
                          left: `${barLeft}%`,
                          width: `${barWidth}%`,
                          height: '100%',
                          background: 'linear-gradient(90deg, #00ffd4, #00d4ff)',
                          borderRadius: 3,
                        }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Explanation box */}
            <div style={{
              background: 'rgba(0,255,212,0.04)',
              border: '1px solid rgba(0,255,212,0.12)',
              borderRadius: 10,
              padding: '14px 18px',
              fontSize: 13,
              color: '#a0b4d0',
              lineHeight: 1.7,
            }}>
              <div style={{ marginBottom: 10 }}>
                The weighted score combines all their confidence levels.
                A bet is only placed when the combined score passes the threshold.
              </div>
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                <div>
                  <span style={{ color: DIM, fontSize: 12 }}>Consensus threshold: </span>
                  <span style={{ color: GREEN, fontWeight: 700, fontFamily: 'monospace' }}>
                    {swarm.consensusThreshold ?? 3}/5
                  </span>
                </div>
                <div>
                  <span style={{ color: DIM, fontSize: 12 }}>Score threshold: </span>
                  <span style={{ color: GREEN, fontWeight: 700, fontFamily: 'monospace' }}>
                    {swarm.threshold}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Panel 2: What the AI Has Learned */}
      {memory && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ background: '#0d1829', border: '1px solid #1a2840', borderRadius: 16, padding: 24 }}>
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 6px 0' }}>📚 What the AI Has Learned</h3>
              <p style={{ fontSize: 13, color: '#a0b4d0', margin: 0, lineHeight: 1.6 }}>
                Based on <strong style={{ color: '#e8edf5' }}>{memory.settledTrades.toLocaleString()} settled trades</strong>,
                the AI has built a profile of which categories and conditions perform best.
              </p>
            </div>

            {/* Category tiles */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 14,
              marginBottom: 16,
            }}>
              {Object.entries(memory.L0_categories).map(([cat, stats]) => {
                const winRatePct = Math.round(stats.winRate * 100)
                const categoryEmoji: Record<string, string> = {
                  sports: '🏆', crypto: '₿', politics: '🏛️', other: '📦',
                }
                const emoji = categoryEmoji[cat] ?? '📊'
                const isStrong = stats.winRate > 0.7
                const catLabel = cat.charAt(0).toUpperCase() + cat.slice(1)

                return (
                  <div key={cat} style={{
                    background: '#07101e',
                    border: `1px solid ${isStrong ? 'rgba(0,255,212,0.15)' : '#1a2840'}`,
                    borderRadius: 12,
                    padding: '16px 18px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <span style={{ fontSize: 20 }}>{emoji}</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#e8edf5' }}>{catLabel}</span>
                      {isStrong && (
                        <span style={{
                          fontSize: 9, fontWeight: 700, color: GREEN,
                          background: 'rgba(0,255,212,0.1)', borderRadius: 20, padding: '1px 7px',
                        }}>STRONG</span>
                      )}
                    </div>

                    {/* Big win rate */}
                    <div style={{ fontSize: 36, fontWeight: 800, fontFamily: 'monospace', color: isStrong ? GREEN : RED, lineHeight: 1 }}>
                      {winRatePct}%
                    </div>
                    <div style={{ fontSize: 11, color: DIM, marginBottom: 10 }}>win rate</div>

                    {/* Trade count */}
                    <div style={{ fontSize: 12, color: '#8099b8', marginBottom: 10 }}>
                      {stats.totalBets.toLocaleString()} trades analysed
                    </div>

                    {/* Progress bar */}
                    <div style={{ background: '#1a2840', borderRadius: 3, height: 5, overflow: 'hidden', marginBottom: 8 }}>
                      <div style={{
                        width: `${winRatePct}%`,
                        height: '100%',
                        background: isStrong ? 'linear-gradient(90deg, #00ffd4, #00d4ff)' : 'rgba(255,68,68,0.5)',
                        borderRadius: 3,
                        transition: 'width 0.5s ease',
                      }} />
                    </div>

                    {/* Plain English insight */}
                    <div style={{ fontSize: 11, color: '#6080a0', lineHeight: 1.5 }}>
                      {isStrong
                        ? `${catLabel} is the strongest category — the AI focuses here.`
                        : `${catLabel} has low performance — the AI avoids this.`}
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{ fontSize: 11, color: DIM }}>
              Last updated: {new Date(memory.generatedAt).toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {/* Panel 3: Recent Research Runs */}
      {experiments.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ background: '#0d1829', border: '1px solid #1a2840', borderRadius: 16, padding: 24 }}>
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 6px 0' }}>🔬 Recent Research Runs</h3>
              <p style={{ fontSize: 13, color: '#a0b4d0', margin: 0, lineHeight: 1.6 }}>
                The AI continuously tests new strategies and updates its own settings. Here&apos;s what it&apos;s been learning:
              </p>
            </div>

            {/* Timeline feed */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {experiments.map((exp, i) => {
                const accepted = exp.result === 'ACCEPTED'
                const rejected = exp.result === 'REJECTED'
                const improvement = exp.improvement ?? (exp.prevBest && exp.brierScore
                  ? +(exp.prevBest - exp.brierScore).toFixed(4) : null)
                const pnlDelta = exp.pnlDelta

                // Build a beginner-friendly summary
                let summary = exp.hypothesis ?? 'Tested a new strategy configuration'
                if (exp.note) summary = exp.note
                // Shorten the note if it's too long
                if (summary.length > 120) summary = summary.slice(0, 117) + '…'

                return (
                  <div key={i} style={{
                    display: 'flex',
                    gap: 16,
                    paddingBottom: i < experiments.length - 1 ? 16 : 0,
                    marginBottom: i < experiments.length - 1 ? 16 : 0,
                    borderBottom: i < experiments.length - 1 ? '1px solid #0f1e33' : 'none',
                  }}>
                    {/* Timeline left */}
                    <div style={{ flexShrink: 0, width: 90, textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: DIM, fontFamily: 'monospace', lineHeight: 1.4 }}>
                        {exp.ts ? new Date(exp.ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '–'}
                      </div>
                      <div style={{ fontSize: 10, color: '#3a5070', fontFamily: 'monospace' }}>
                        {exp.ts ? new Date(exp.ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </div>
                    </div>

                    {/* Dot */}
                    <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{
                        width: 10, height: 10, borderRadius: '50%', marginTop: 2,
                        background: accepted ? GREEN : rejected ? RED : DIM,
                        boxShadow: accepted ? `0 0 6px ${GREEN}` : 'none',
                      }} />
                      {i < experiments.length - 1 && (
                        <div style={{ flex: 1, width: 1, background: '#1a2840', marginTop: 4 }} />
                      )}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                        <span style={{ fontSize: 13, color: '#c0d0e0', lineHeight: 1.5, flex: 1 }}>
                          {summary}
                        </span>
                        {/* Result badge */}
                        {exp.result && (
                          <span style={{
                            fontSize: 10, fontWeight: 700, flexShrink: 0,
                            color: accepted ? GREEN : rejected ? RED : DIM,
                            background: accepted ? 'rgba(0,255,212,0.08)' : rejected ? 'rgba(255,68,68,0.08)' : '#111d35',
                            border: `1px solid ${accepted ? 'rgba(0,255,212,0.2)' : rejected ? 'rgba(255,68,68,0.2)' : '#1a2840'}`,
                            borderRadius: 20, padding: '2px 9px',
                          }}>
                            {accepted ? '✓ ACCEPTED' : '✗ REJECTED'}
                          </span>
                        )}
                        {/* PnL delta badge */}
                        {pnlDelta != null && (
                          <span style={{
                            fontSize: 10, fontWeight: 700, flexShrink: 0,
                            color: pnlDelta >= 0 ? GREEN : RED,
                            background: pnlDelta >= 0 ? 'rgba(0,255,212,0.08)' : 'rgba(255,68,68,0.08)',
                            border: `1px solid ${pnlDelta >= 0 ? 'rgba(0,255,212,0.2)' : 'rgba(255,68,68,0.2)'}`,
                            borderRadius: 20, padding: '2px 9px',
                          }}>
                            {pnlDelta >= 0 ? '+' : ''}{pnlDelta.toFixed(1)} PnL
                          </span>
                        )}
                        {/* Improvement badge */}
                        {improvement != null && Math.abs(improvement) > 0.0001 && (
                          <span style={{
                            fontSize: 10, fontWeight: 700, flexShrink: 0,
                            color: improvement > 0 ? GREEN : RED,
                            background: improvement > 0 ? 'rgba(0,255,212,0.08)' : 'rgba(255,68,68,0.08)',
                            border: `1px solid ${improvement > 0 ? 'rgba(0,255,212,0.2)' : 'rgba(255,68,68,0.2)'}`,
                            borderRadius: 20, padding: '2px 9px',
                          }}>
                            {improvement > 0 ? '▲' : '▼'} Brier {Math.abs(improvement).toFixed(4)}
                          </span>
                        )}
                      </div>
                      {/* Key stats line */}
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        {exp.winRate != null && (
                          <span style={{ fontSize: 11, color: DIM }}>
                            Win rate: <span style={{ color: '#a0b4d0', fontFamily: 'monospace' }}>{Math.round(exp.winRate * 100)}%</span>
                          </span>
                        )}
                        {exp.nSignals != null && (
                          <span style={{ fontSize: 11, color: DIM }}>
                            Signals: <span style={{ color: '#a0b4d0', fontFamily: 'monospace' }}>{exp.nSignals}</span>
                          </span>
                        )}
                        {exp.brierScore != null && (
                          <span style={{ fontSize: 11, color: DIM }}>
                            Brier score: <span style={{ color: '#a0b4d0', fontFamily: 'monospace' }}>{exp.brierScore.toFixed(4)}</span>
                            <span style={{ color: '#3a5070', fontSize: 10 }}> (lower=better)</span>
                          </span>
                        )}
                        {exp.totalPnL != null && (
                          <span style={{ fontSize: 11, color: DIM }}>
                            Total P&L: <span style={{
                              color: exp.totalPnL >= 0 ? GREEN : RED,
                              fontFamily: 'monospace',
                            }}>{exp.totalPnL >= 0 ? '+' : ''}${exp.totalPnL}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
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
      <div style={{ background: '#050d1a', borderBottom: '1px solid #1a2840', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 24 }}>
        <span style={{ fontWeight: 800, fontSize: 16, color: GREEN, letterSpacing: '-0.02em' }}>KALSHI</span>
        {[
          { href: '/', label: 'Dashboard' },
          { href: '/experiments', label: 'Experiments' },
          { href: '/research', label: 'Strategy Tester' },
        ].map(nav => (
          <Link key={nav.href} href={nav.href}
            style={{ fontSize: 13, color: nav.href === '/research' ? GREEN : '#5a7399', textDecoration: 'none', fontWeight: nav.href === '/research' ? 700 : 400 }}>
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
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 28 }}>

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
