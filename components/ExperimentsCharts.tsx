'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ScatterChart, Scatter, ZAxis,
  Cell, BarChart, Bar, ReferenceLine, Legend
} from 'recharts'

interface Experiment {
  ts: string
  params: {
    minTradeUSD: number
    impliedRange: [number, number]
    ewmaDecay: number
    kellyFraction: number
    skipCategories: string[]
    minContracts: number
    lookbackDays: number
  }
  result: 'INSUFFICIENT' | 'REJECTED' | 'IMPROVED'
  brierScore?: number
  prevBest?: number
  winRate?: number
  nSignals?: number
  totalPnL?: number
  sharpe?: number
  hypothesis?: string
  note?: string
}

const COLORS = {
  IMPROVED: '#06d6a0',
  REJECTED: '#ef476f',
  INSUFFICIENT: '#4cc9f0',
  accent: '#4cc9f0',
  grid: '#1e2a4a',
  text: '#9aa8d3',
  bg: '#131b33',
}

function formatTS(ts: string) {
  return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
}

// --- Brier Score Over Time ---
export function BrierOverTime({ experiments }: { experiments: Experiment[] }) {
  const scored = experiments
    .filter(e => e.brierScore !== undefined && e.result !== 'INSUFFICIENT')
    .map((e, i) => ({
      i,
      ts: formatTS(e.ts),
      brier: Number(e.brierScore!.toFixed(4)),
      result: e.result,
      prevBest: e.prevBest,
    }))

  // running best line
  let best = Infinity
  const withBest = scored.map(e => {
    if (e.brier < best) best = e.brier
    return { ...e, runningBest: Number(best.toFixed(4)) }
  })

  return (
    <div className="card">
      <h2 className="card-title">Brier Score — All Experiments</h2>
      <p className="text-xs text-muted mb-4">Lower = better. Green line = running best.</p>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={withBest} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
          <XAxis dataKey="i" tick={{ fill: COLORS.text, fontSize: 11 }} label={{ value: 'Experiment #', position: 'insideBottom', offset: -4, fill: COLORS.text, fontSize: 11 }} />
          <YAxis tick={{ fill: COLORS.text, fontSize: 11 }} domain={[0, 0.4]} />
          <Tooltip
            contentStyle={{ background: '#0b1020', border: '1px solid #24325e', borderRadius: 8 }}
            labelStyle={{ color: COLORS.text }}
          />
          <Legend wrapperStyle={{ color: COLORS.text, fontSize: 12 }} />
          <Line type="monotone" dataKey="brier" stroke="#ef476f" dot={false} strokeWidth={1} name="Brier Score" opacity={0.5} />
          <Line type="monotone" dataKey="runningBest" stroke={COLORS.IMPROVED} dot={false} strokeWidth={2} name="Running Best" />
          <ReferenceLine y={0.25} stroke="#9b5de5" strokeDasharray="4 4" label={{ value: 'Random (0.25)', fill: '#9b5de5', fontSize: 10 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// --- Result Distribution Bar ---
export function ResultDistribution({ experiments }: { experiments: Experiment[] }) {
  const counts = { IMPROVED: 0, REJECTED: 0, INSUFFICIENT: 0 }
  experiments.forEach(e => counts[e.result]++)

  const data = [
    { name: 'Improved', count: counts.IMPROVED, fill: COLORS.IMPROVED },
    { name: 'Rejected', count: counts.REJECTED, fill: COLORS.REJECTED },
    { name: 'Insufficient\nData', count: counts.INSUFFICIENT, fill: COLORS.INSUFFICIENT },
  ]

  return (
    <div className="card">
      <h2 className="card-title">Experiment Results</h2>
      <p className="text-xs text-muted mb-4">{experiments.length} total experiments run</p>
      <div className="flex gap-4 mb-4">
        {data.map(d => (
          <div key={d.name} className="flex-1 rounded-xl p-4 text-center" style={{ background: d.fill + '18', border: `1px solid ${d.fill}40` }}>
            <div className="text-3xl font-bold" style={{ color: d.fill }}>{d.count}</div>
            <div className="text-xs mt-1" style={{ color: COLORS.text }}>{d.name}</div>
          </div>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
          <XAxis dataKey="name" tick={{ fill: COLORS.text, fontSize: 11 }} />
          <YAxis tick={{ fill: COLORS.text, fontSize: 11 }} />
          <Tooltip contentStyle={{ background: '#0b1020', border: '1px solid #24325e', borderRadius: 8 }} labelStyle={{ color: COLORS.text }} />
          <Bar dataKey="count" radius={[6, 6, 0, 0]}>
            {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// --- Win Rate vs Brier Scatter ---
export function WinRatevsBrier({ experiments }: { experiments: Experiment[] }) {
  const data = experiments
    .filter(e => e.brierScore !== undefined && e.winRate !== undefined && e.result !== 'INSUFFICIENT')
    .map(e => ({
      brier: Number(e.brierScore!.toFixed(4)),
      winRate: Number(((e.winRate ?? 0) * 100).toFixed(1)),
      pnl: e.totalPnL ?? 0,
      result: e.result,
      note: e.note,
    }))

  const improved = data.filter(d => d.result === 'IMPROVED')
  const rejected = data.filter(d => d.result === 'REJECTED')

  return (
    <div className="card">
      <h2 className="card-title">Win Rate vs Brier Score</h2>
      <p className="text-xs text-muted mb-4">Sweet spot: high win rate + low Brier score (bottom-right)</p>
      <ResponsiveContainer width="100%" height={280}>
        <ScatterChart margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
          <XAxis dataKey="brier" name="Brier Score" type="number" tick={{ fill: COLORS.text, fontSize: 11 }} label={{ value: 'Brier Score →', position: 'insideBottom', offset: -4, fill: COLORS.text, fontSize: 11 }} domain={[0, 0.4]} />
          <YAxis dataKey="winRate" name="Win Rate %" type="number" tick={{ fill: COLORS.text, fontSize: 11 }} label={{ value: 'Win Rate %', angle: -90, position: 'insideLeft', fill: COLORS.text, fontSize: 11 }} />
          <ZAxis range={[40, 40]} />
          <Tooltip
            contentStyle={{ background: '#0b1020', border: '1px solid #24325e', borderRadius: 8 }}
            cursor={{ strokeDasharray: '3 3' }}
          />
          <Legend wrapperStyle={{ color: COLORS.text, fontSize: 12 }} />
          <Scatter name="Rejected" data={rejected} fill={COLORS.REJECTED} opacity={0.4} />
          <Scatter name="Improved ✅" data={improved} fill={COLORS.IMPROVED} opacity={1} />
          <ReferenceLine x={0.25} stroke="#9b5de5" strokeDasharray="4 4" />
          <ReferenceLine y={50} stroke="#ffd166" strokeDasharray="4 4" />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}

// --- Implied Range Heatmap (simplified as scatter) ---
export function ImpliedRangeMap({ experiments }: { experiments: Experiment[] }) {
  const data = experiments
    .filter(e => e.brierScore !== undefined && e.result !== 'INSUFFICIENT')
    .map(e => ({
      low: e.params.impliedRange[0] * 100,
      high: e.params.impliedRange[1] * 100,
      brier: Number(e.brierScore!.toFixed(4)),
      result: e.result,
    }))

  const improved = data.filter(d => d.result === 'IMPROVED')
  const rejected = data.filter(d => d.result === 'REJECTED')

  return (
    <div className="card">
      <h2 className="card-title">Implied Range Parameter Space</h2>
      <p className="text-xs text-muted mb-4">X = lower bound %, Y = upper bound %. Green = improvements found.</p>
      <ResponsiveContainer width="100%" height={280}>
        <ScatterChart margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
          <XAxis dataKey="low" name="Lower Bound" type="number" tick={{ fill: COLORS.text, fontSize: 11 }} label={{ value: 'Lower Bound %', position: 'insideBottom', offset: -4, fill: COLORS.text, fontSize: 11 }} domain={[20, 100]} />
          <YAxis dataKey="high" name="Upper Bound" type="number" tick={{ fill: COLORS.text, fontSize: 11 }} label={{ value: 'Upper Bound %', angle: -90, position: 'insideLeft', fill: COLORS.text, fontSize: 11 }} domain={[40, 110]} />
          <ZAxis range={[40, 40]} />
          <Tooltip contentStyle={{ background: '#0b1020', border: '1px solid #24325e', borderRadius: 8 }} cursor={{ strokeDasharray: '3 3' }} />
          <Legend wrapperStyle={{ color: COLORS.text, fontSize: 12 }} />
          <Scatter name="Rejected" data={rejected} fill={COLORS.REJECTED} opacity={0.35} />
          <Scatter name="Improved ✅" data={improved} fill={COLORS.IMPROVED} opacity={1} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}

// --- minTradeUSD Impact ---
export function TradeUSDImpact({ experiments }: { experiments: Experiment[] }) {
  const byUSD: Record<number, { briers: number[], wins: number[], pnls: number[] }> = {}
  experiments
    .filter(e => e.brierScore !== undefined && e.result !== 'INSUFFICIENT')
    .forEach(e => {
      const k = e.params.minTradeUSD
      if (!byUSD[k]) byUSD[k] = { briers: [], wins: [], pnls: [] }
      byUSD[k].briers.push(e.brierScore!)
      if (e.winRate) byUSD[k].wins.push(e.winRate)
      if (e.totalPnL !== undefined) byUSD[k].pnls.push(e.totalPnL)
    })

  const data = Object.entries(byUSD).map(([usd, v]) => ({
    usd: `$${usd}`,
    avgBrier: Number((v.briers.reduce((a, b) => a + b, 0) / v.briers.length).toFixed(4)),
    avgWinRate: v.wins.length ? Number(((v.wins.reduce((a, b) => a + b, 0) / v.wins.length) * 100).toFixed(1)) : 0,
    experiments: v.briers.length,
  })).sort((a, b) => parseFloat(a.usd.slice(1)) - parseFloat(b.usd.slice(1)))

  return (
    <div className="card">
      <h2 className="card-title">Min Trade Size Impact</h2>
      <p className="text-xs text-muted mb-4">Avg Brier score grouped by minTradeUSD setting</p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
          <XAxis dataKey="usd" tick={{ fill: COLORS.text, fontSize: 11 }} />
          <YAxis tick={{ fill: COLORS.text, fontSize: 11 }} domain={[0, 0.4]} />
          <Tooltip contentStyle={{ background: '#0b1020', border: '1px solid #24325e', borderRadius: 8 }} labelStyle={{ color: COLORS.text }} />
          <Legend wrapperStyle={{ color: COLORS.text, fontSize: 12 }} />
          <Bar dataKey="avgBrier" name="Avg Brier (lower=better)" fill={COLORS.accent} radius={[6, 6, 0, 0]} opacity={0.85} />
          <ReferenceLine y={0.25} stroke="#9b5de5" strokeDasharray="4 4" label={{ value: 'Random', fill: '#9b5de5', fontSize: 10 }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

