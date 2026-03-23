'use client'

import { useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ReferenceLine,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  Label,
  Cell,
} from 'recharts'

// ─── Data ───────────────────────────────────────────────────────────────────

const LAST_RUN_RESULTS = [
  { id: 1,   label: 'Baseline',      fullLabel: 'HIGH-CONF: implied 75%+, $1K min',          pnl: 694,    brier: 0.0646, n: 162, result: 'baseline' },
  { id: 2,   label: '78%+ conf',     fullLabel: 'HIGH-CONF: implied 78%+',                   pnl: 708,    brier: 0.051,  n: 146, result: 'improved' },
  { id: 5,   label: '84%+ conf',     fullLabel: 'HIGH-CONF: implied 84%+',                   pnl: 766,    brier: 0.0079, n: 107, result: 'improved' },
  { id: 18,  label: '85%+ $200 min', fullLabel: 'COMBO: implied 85%+, $200 min trade',        pnl: 1300.1, brier: 0.0104, n: 205, result: 'improved' },
  { id: 110, label: 'Wildcard-A',    fullLabel: 'Wide range + med trade + fast EWMA',         pnl: 3325.2, brier: 0.0925, n: 408, result: 'best' },
]

const SUMMARY = {
  experiments: 157,
  improvements: 5,
  bestPnL: 3325.2,
  baseline: 694,
  elapsed: '11.2s',
  runAt: '2026-03-23T01:47:27Z',
}

const REJECTED_SCATTER = [
  { n: 35,  pnl: -212, label: 'CLUSTER strategy' },
  { n: 38,  pnl: -136, label: 'CLUSTER+WIDER' },
  { n: 162, pnl: 694,  label: 'Baseline' },
  { n: 86,  pnl: 983,  label: 'Ultra-recent 3d' },
  { n: 180, pnl: 980,  label: 'CAP-TOP 0.65-0.97' },
  { n: 148, pnl: 641,  label: 'Near-certainty' },
  { n: 240, pnl: 1143, label: 'Random combo #1' },
  { n: 286, pnl: 1402, label: 'Random combo #3' },
  { n: 163, pnl: 921,  label: 'CAP-TOP 0.65-0.95' },
  { n: 258, pnl: 1276, label: 'Random combo #5' },
  { n: 279, pnl: 1527, label: 'Random combo #6' },
  { n: 211, pnl: 1086, label: 'Wide range 63%' },
  { n: 100, pnl: 654,  label: '85%+ $1K min' },
  { n: 71,  pnl: 273,  label: '90%+ only' },
  { n: 23,  pnl: 404,  label: 'Dip 5-18c' },
  { n: 104, pnl: 169,  label: '80%+ $1500 min' },
  { n: 136, pnl: 493,  label: '80%+ $1K min' },
  { n: 25,  pnl: 1046, label: 'Wide dip cluster' },
  { n: 369, pnl: 2453, label: 'Wide 66%+ random' },
  { n: 270, pnl: 1291, label: 'Random full #8' },
]

const GLOSSARY = [
  { metric: 'P&L',           explanation: 'Total dollars made if you bet $100 on every matching signal in the dataset.',                                              dir: 'Higher = better', dirUp: true },
  { metric: 'Brier Score',   explanation: 'Prediction accuracy. 0 = perfect, 1 = worst. Measures if the confidence% reflects reality.',                              dir: 'Lower = better',  dirUp: false },
  { metric: 'n (signals)',   explanation: 'How many historical bets matched this strategy\'s filters.',                                                               dir: 'More = more data (lower selectivity)',  dirUp: null },
  { metric: 'Implied Range', explanation: '"85–100%" means only follow bets the market is 85%+ sure about.',                                                          dir: 'Depends',         dirUp: null },
  { metric: 'Min Trade USD', explanation: 'Minimum dollar size the original trade must be for us to follow it. Filters out small, noise bets.',                        dir: 'Higher = more selective', dirUp: null },
  { metric: 'EWMA Decay',    explanation: 'How fast we forget old data. High decay (0.9) = weight history. Low decay (0.1) = react to recent.',                       dir: 'Depends',         dirUp: null },
  { metric: 'Kelly Fraction',explanation: 'What fraction of bankroll to risk. 0.5 = half Kelly (safer). 1.0 = full Kelly (max growth, high risk).',                   dir: 'Depends',         dirUp: null },
]

// ─── Colors ──────────────────────────────────────────────────────────────────

const COLOR = {
  teal:    '#00ffd4',
  green:   '#00ff88',
  red:     '#ff3344',
  amber:   '#ffaa00',
  grey:    '#4A6880',
  card:    '#0a1628',
  bg:      '#020408',
  border:  'rgba(0,255,212,0.12)',
  muted:   '#6b7f9e',
}

function barColor(result: string) {
  if (result === 'best')     return COLOR.amber
  if (result === 'improved') return COLOR.teal
  return COLOR.grey
}

// ─── Custom bar tooltip ───────────────────────────────────────────────────────

function BarTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: typeof LAST_RUN_RESULTS[0] }> }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{ background: '#111d30', border: `1px solid ${COLOR.teal}`, borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
      <div style={{ color: COLOR.teal, fontWeight: 700, marginBottom: 4 }}>{d.fullLabel}</div>
      <div style={{ color: '#fff' }}>P&amp;L: <strong style={{ color: COLOR.green }}>${d.pnl.toLocaleString()}</strong></div>
      <div style={{ color: '#fff' }}>Brier: <strong style={{ color: COLOR.amber }}>{d.brier}</strong></div>
      <div style={{ color: '#fff' }}>Signals: <strong>{d.n}</strong></div>
    </div>
  )
}

// ─── Custom scatter tooltip ────────────────────────────────────────────────────

function ScatterTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { n: number; pnl: number; label: string } }> }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{ background: '#111d30', border: `1px solid ${COLOR.teal}`, borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
      <div style={{ color: COLOR.teal, fontWeight: 600 }}>{d.label}</div>
      <div style={{ color: '#ccc' }}>n={d.n} · P&amp;L ${d.pnl.toLocaleString()}</div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AutoresearchPage() {
  const [failuresOpen, setFailuresOpen] = useState(false)

  // Scatter data: merge
  const successScatter = LAST_RUN_RESULTS.map(r => ({ n: r.n, pnl: r.pnl, label: r.label, type: r.result }))
  const rejectedScatter = REJECTED_SCATTER.map(r => ({ ...r, type: 'rejected' }))

  return (
    <div style={{ background: COLOR.bg, minHeight: '100vh', color: '#e2eaf5', fontFamily: 'system-ui, sans-serif', paddingBottom: 80 }}>
      {/* Page title */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 20px 0' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#fff', marginBottom: 4 }}>
          🧪 Auto-Research Results
        </h1>
        <p style={{ color: COLOR.muted, marginBottom: 28 }}>
          Run completed · {new Date(SUMMARY.runAt).toLocaleString()} · {SUMMARY.elapsed} elapsed
        </p>

        {/* ── Section 1: Hero ── */}
        <div style={{
          background: COLOR.card,
          border: `1.5px solid ${COLOR.teal}`,
          borderRadius: 16,
          padding: '28px 24px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 24,
          justifyContent: 'space-around',
          marginBottom: 32,
        }}>
          <HeroStat value="5"      color={COLOR.green} label="improvements found" />
          <HeroStat value="157"    color="#fff"         label="experiments run" />
          <HeroStat value="11.2s"  color={COLOR.teal}   label="time to complete" />
          <HeroStat value="+$3,325" color={COLOR.green} label="best strategy P&L" size="xl" />
          <HeroStat value="4.8×"   color={COLOR.amber}  label="vs baseline" />
        </div>

        {/* ── Section 2: Explainer cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 40 }}>
          <ExplainerCard icon="💰" title="What is P&L?" text="P&L stands for Profit and Loss. If the system found 408 signals and you bet $100 on each one, the best strategy would have made +$3,325 in total profit. This is simulated on past real data — not real money placed yet." />
          <ExplainerCard icon="🎯" title="What is Brier Score?" text="Brier Score measures how accurate predictions are. It goes from 0 (perfect) to 1 (completely wrong). A score of 0.009 means the system is extremely well-calibrated. The best strategy scores 0.093 — still good, but it trades some accuracy for more volume." />
          <ExplainerCard icon="🧪" title="What is an Experiment?" text="Each experiment tests a different combination of rules: which confidence level to require, the minimum bet size to follow, how far back to look. 157 combinations were tested. Only the ones beating the previous best are kept." />
        </div>

        {/* ── Section 3: P&L Bar Chart ── */}
        <SectionCard title="How strategies improved — step by step" subtitle="Each bar = a different betting strategy. The system kept only the ones that beat the bar before.">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={LAST_RUN_RESULTS} margin={{ top: 20, right: 20, left: 10, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="label" tick={{ fill: COLOR.muted, fontSize: 12 }} />
              <YAxis tickFormatter={(v: number) => `$${v.toLocaleString()}`} tick={{ fill: COLOR.muted, fontSize: 11 }} />
              <RechartsTooltip content={<BarTooltip />} />
              <ReferenceLine y={694} stroke={COLOR.red} strokeDasharray="6 3" label={{ value: 'Baseline $694', fill: COLOR.red, fontSize: 11, position: 'insideTopRight' }} />
              <Bar dataKey="pnl" radius={[6, 6, 0, 0]}>
                {LAST_RUN_RESULTS.map((entry) => (
                  <Cell key={entry.id} fill={barColor(entry.result)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p style={{ fontSize: 12, color: COLOR.muted, marginTop: 8, textAlign: 'center' }}>
            P&amp;L is simulated — based on what would have happened if you bet $100 on each historical signal.
          </p>
        </SectionCard>

        {/* ── Section 4: Scatter Plot ── */}
        <SectionCard title="All 157 experiments at a glance" subtitle="Each dot = one experiment. Right = more bets, Up = more profit. Green = beat the previous best.">
          <ResponsiveContainer width="100%" height={360}>
            <ScatterChart margin={{ top: 20, right: 30, left: 10, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis
                dataKey="n"
                type="number"
                domain={[0, 450]}
                tick={{ fill: COLOR.muted, fontSize: 11 }}
                name="Signals"
              >
                <Label value="Number of bets (signals matched)" offset={-10} position="insideBottom" fill={COLOR.muted} fontSize={12} />
              </XAxis>
              <YAxis
                dataKey="pnl"
                type="number"
                domain={[-400, 3600]}
                tickFormatter={(v: number) => `$${v}`}
                tick={{ fill: COLOR.muted, fontSize: 11 }}
                name="P&L"
              >
                <Label value="Simulated P&L ($)" angle={-90} position="insideLeft" fill={COLOR.muted} fontSize={12} />
              </YAxis>
              <RechartsTooltip content={<ScatterTooltip />} />
              <ReferenceLine y={0}   stroke={COLOR.red}  strokeDasharray="4 3" label={{ value: 'Break-even', fill: COLOR.red,  fontSize: 10, position: 'insideTopRight' }} />
              <ReferenceLine y={694} stroke={COLOR.grey} strokeDasharray="4 3" label={{ value: 'Baseline',   fill: COLOR.grey, fontSize: 10, position: 'insideTopRight' }} />

              {/* Rejected points */}
              <Scatter name="Rejected" data={rejectedScatter} fill="rgba(255,68,68,0.5)" />

              {/* Improved points */}
              <Scatter
                name="Improved"
                data={successScatter.filter(d => d.type === 'improved')}
                fill={COLOR.teal}
              />

              {/* Baseline */}
              <Scatter
                name="Baseline"
                data={successScatter.filter(d => d.type === 'baseline')}
                fill={COLOR.grey}
              />

              {/* Best */}
              <Scatter
                name="Best"
                data={successScatter.filter(d => d.type === 'best')}
                fill={COLOR.amber}
              />
            </ScatterChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginTop: 10, fontSize: 12, color: COLOR.muted, justifyContent: 'center' }}>
            <LegendDot color="rgba(255,68,68,0.5)" label="Rejected experiments" />
            <LegendDot color={COLOR.grey}  label="Baseline" />
            <LegendDot color={COLOR.teal}  label="Improved" />
            <LegendDot color={COLOR.amber} label="Best (Wildcard-A) ⭐" />
          </div>
        </SectionCard>

        {/* ── Section 5: Glossary ── */}
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Every term, explained</h2>
          <p style={{ color: COLOR.muted, marginBottom: 18, fontSize: 14 }}>Plain-English definitions for every metric you see on this page.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
            {GLOSSARY.map(g => (
              <div key={g.metric} style={{ background: COLOR.card, border: `1px solid ${COLOR.border}`, borderRadius: 12, padding: '16px 18px' }}>
                <div style={{ fontFamily: 'monospace', color: COLOR.teal, fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{g.metric}</div>
                <div style={{ color: '#c8d8ee', fontSize: 13, lineHeight: 1.55, marginBottom: 10 }}>{g.explanation}</div>
                <span style={{
                  display: 'inline-block',
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 20,
                  background: g.dirUp === true ? 'rgba(0,255,136,0.12)' : g.dirUp === false ? 'rgba(255,51,68,0.12)' : 'rgba(255,170,0,0.12)',
                  color:       g.dirUp === true ? COLOR.green           : g.dirUp === false ? COLOR.red                : COLOR.amber,
                  fontWeight: 600,
                }}>
                  {g.dirUp === true ? '↑' : g.dirUp === false ? '↓' : '↕'} {g.dir}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Section 6: Best Strategy Deep Dive ── */}
        <div style={{
          background: 'rgba(255,170,0,0.04)',
          border: `2px solid ${COLOR.amber}`,
          borderRadius: 16,
          padding: '28px 24px',
          marginBottom: 32,
        }}>
          <div style={{ fontSize: 13, color: COLOR.amber, fontWeight: 600, letterSpacing: '0.08em', marginBottom: 8, textTransform: 'uppercase' }}>
            🏆 This Week's Winning Strategy
          </div>
          <div style={{ fontSize: 30, fontWeight: 900, color: COLOR.amber, marginBottom: 4 }}>WILDCARD-A</div>
          <div style={{ color: COLOR.muted, fontSize: 14, marginBottom: 18 }}>
            Wide confidence range + medium trade size + fast EWMA decay
          </div>

          {/* Stats row */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, marginBottom: 24 }}>
            <StatPill label="P&L" value="+$3,325" color={COLOR.green} />
            <StatPill label="Brier" value="0.093" color={COLOR.teal} />
            <StatPill label="Signals" value="408" color="#fff" />
            <StatPill label="vs Baseline" value="4.8×" color={COLOR.amber} />
          </div>

          {/* Breakdown */}
          <div style={{ background: '#020c1a', borderRadius: 12, padding: '20px 22px', marginBottom: 16, lineHeight: 1.7, fontSize: 14, color: '#c8d8ee' }}>
            <p style={{ marginBottom: 12 }}>
              <strong style={{ color: '#fff' }}>What this strategy does:</strong>{' '}
              Instead of waiting for the market to be 84%+ confident, this strategy follows bets where the market is moderately confident (65%+),
              as long as the trade is at least $200. It also weights recent betting patterns more heavily (fast EWMA), catching momentum shifts earlier.
            </p>
            <p style={{ marginBottom: 12 }}>
              <strong style={{ color: '#fff' }}>Why it wins:</strong>{' '}
              More signals = more opportunities. The win rate on 65%+ markets is still high enough that volume beats selectivity.
            </p>
            <p style={{ marginBottom: 0 }}>
              <strong style={{ color: '#fff' }}>The tradeoff:</strong>{' '}
              Brier score of 0.093 vs 0.008 for the most selective strategy. It's less "sure" on each individual bet,
              but makes up for it with 4× more volume.
            </p>
          </div>

          <div style={{
            background: 'rgba(255,170,0,0.08)',
            border: '1px solid rgba(255,170,0,0.3)',
            borderRadius: 10,
            padding: '12px 16px',
            fontSize: 13,
            color: COLOR.amber,
          }}>
            ⚠️ This is backtested on historical data. Past performance doesn't guarantee future results.
            The live trading bot uses this config until the next autoresearch run.
          </div>
        </div>

        {/* ── Section 7: What Didn't Work ── */}
        <div style={{ marginBottom: 32 }}>
          <button
            onClick={() => setFailuresOpen(o => !o)}
            style={{
              width: '100%',
              background: COLOR.card,
              border: `1px solid ${COLOR.border}`,
              borderRadius: 12,
              padding: '16px 22px',
              color: '#fff',
              fontSize: 16,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              textAlign: 'left',
            }}
          >
            <span>❌ What Didn't Work — Rejected Strategy Families</span>
            <span style={{ color: COLOR.muted, fontSize: 20 }}>{failuresOpen ? '▲' : '▼'}</span>
          </button>

          {failuresOpen && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, marginTop: 14 }}>
              <FailCard
                title="CLUSTER strategies (crowd burst)"
                range="-$212 to -$136 P&L"
                explanation='Waiting for 3 bets within 5 minutes is too slow — by the time you see the burst, the signal has already moved.'
              />
              <FailCard
                title="DIP strategies (price drop filter)"
                range="$150–450 P&L · only 5–28 signals"
                explanation='Interesting pattern but too few data points to draw conclusions. Needs more data.'
              />
              <FailCard
                title="Ultra-high confidence only (90%+)"
                range="$273 P&L · 71 signals"
                explanation="Too selective. At 90%+ confidence, you're betting at 91¢+ — even if you're right, the profit per bet is tiny."
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function HeroStat({ value, color, label, size = 'lg' }: { value: string; color: string; label: string; size?: string }) {
  return (
    <div style={{ textAlign: 'center', minWidth: 100 }}>
      <div style={{ fontSize: size === 'xl' ? 40 : 32, fontWeight: 900, color, lineHeight: 1, marginBottom: 6 }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: '#6b7f9e', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
    </div>
  )
}

function ExplainerCard({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div style={{ background: '#0a1628', border: '1px solid rgba(0,255,212,0.12)', borderRadius: 14, padding: '22px 20px' }}>
      <div style={{ fontSize: 28, marginBottom: 10 }}>{icon}</div>
      <div style={{ fontWeight: 700, color: '#fff', fontSize: 16, marginBottom: 8 }}>{title}</div>
      <div style={{ color: '#8fa8c8', fontSize: 13, lineHeight: 1.65 }}>{text}</div>
    </div>
  )
}

function SectionCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: '#0a1628',
      border: '1px solid rgba(0,255,212,0.12)',
      borderRadius: 16,
      padding: '24px 20px',
      marginBottom: 32,
    }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{title}</h2>
      <p style={{ fontSize: 13, color: '#6b7f9e', marginBottom: 20 }}>{subtitle}</p>
      {children}
    </div>
  )
}

function StatPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 11, color: '#6b7f9e', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
    </div>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span>{label}</span>
    </div>
  )
}

function FailCard({ title, range, explanation }: { title: string; range: string; explanation: string }) {
  return (
    <div style={{
      background: '#0d0a14',
      border: '1px solid rgba(255,51,68,0.2)',
      borderRadius: 12,
      padding: '18px 18px',
    }}>
      <div style={{ fontWeight: 700, color: '#ff6680', fontSize: 14, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 12, color: '#ff3344', marginBottom: 8 }}>{range}</div>
      <div style={{ fontSize: 13, color: '#8fa8c8', lineHeight: 1.6 }}>{explanation}</div>
    </div>
  )
}
