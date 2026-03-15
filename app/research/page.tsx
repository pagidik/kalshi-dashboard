'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, ReferenceLine,
} from 'recharts'

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
          <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 8, letterSpacing: '-0.02em' }}>
            🧪 Strategy Tester
          </h1>
          <p style={{ fontSize: 14, color: '#a0b4d0', lineHeight: 1.7, maxWidth: 680 }}>
            Test different betting strategies against real historical signals. Adjust the filters below and hit <strong style={{ color: '#e8edf5' }}>Run</strong> — it instantly shows how that strategy would have performed on past data.
            Not sure where to start? <strong style={{ color: GREEN }}>Try the quick presets on the left.</strong>
          </p>
        </div>

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
      </div>
    </div>
  )
}
