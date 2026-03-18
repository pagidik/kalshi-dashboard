import experimentsData from '../../public/data/experiments.json'
import hypothesisData from '../../public/data/hypothesis-history.json'
import { BrierOverTime, ResultDistribution, WinRatevsBrier, ImpliedRangeMap, TradeUSDImpact } from '../../components/ExperimentsCharts'
import HypothesisChart from '../../components/HypothesisChart'
import Link from 'next/link'

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

const experiments = experimentsData as unknown as Experiment[]

export default function ExperimentsPage() {
  const improved = experiments.filter(e => e.result === 'IMPROVED')
  const scored = experiments.filter(e => e.brierScore !== undefined && e.result !== 'INSUFFICIENT')
  const bestBrier = Math.min(...scored.map(e => e.brierScore!))
  const bestExp = scored.find(e => e.brierScore === bestBrier)
  const latestImproved = improved[improved.length - 1]

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-12">
      {/* Header */}
      <div className="flex items-center gap-4 mb-2">
        <Link href="/" className="text-sm text-muted hover:text-accent transition-colors">← Dashboard</Link>
      </div>
      <header className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Autoresearch Lab</h1>
          <span className="flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
            <span className="inline-block h-2 w-2 rounded-full bg-accent animate-pulse-glow" />
            Self-Improving
          </span>
        </div>
        <p className="text-base text-muted">Parameter optimization experiments — finding the edge automatically</p>
        <p className="mt-1 text-xs text-muted">
          Last run: {new Date(experiments[experiments.length - 1]?.ts).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
        </p>
      </header>

      {/* KPI row */}
      <section className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="card text-center">
          <div className="kpi text-accent">{experiments.length}</div>
          <div className="kpi-label">Total Experiments</div>
        </div>
        <div className="card text-center">
          <div className="kpi text-green">{improved.length}</div>
          <div className="kpi-label">Improvements Found</div>
        </div>
        <div className="card text-center">
          <div className="kpi text-accent">{bestBrier.toFixed(4)}</div>
          <div className="kpi-label">Best Brier Score</div>
          <div className="text-xs text-muted mt-1">vs 0.25 random baseline</div>
        </div>
        <div className="card text-center">
          <div className="kpi" style={{ color: (latestImproved?.winRate ?? 0) >= 0.6 ? '#06d6a0' : '#ffd166' }}>
            {latestImproved ? ((latestImproved.winRate ?? 0) * 100).toFixed(1) + '%' : '—'}
          </div>
          <div className="kpi-label">Latest Win Rate</div>
          <div className="text-xs text-muted mt-1">on winning config</div>
        </div>
      </section>

      {/* Improvement Timeline */}
      {improved.length > 0 && (
        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-4">🏆 Improvements Found</h2>
          <div className="space-y-3 overflow-y-auto" style={{ maxHeight: '400px' }}>
            {improved.map((e, i) => (
              <div key={i} className="card border-l-4" style={{ borderLeftColor: '#06d6a0' }}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-muted">{new Date(e.ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}</span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: '#06d6a020', color: '#06d6a0' }}>IMPROVED</span>
                    </div>
                    <p className="text-sm font-medium">{e.hypothesis}</p>
                    <p className="text-xs text-muted mt-1">{e.note}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-lg font-bold text-green">{e.brierScore?.toFixed(4)}</div>
                      <div className="text-xs text-muted">Brier Score</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-accent">{((e.winRate ?? 0) * 100).toFixed(1)}%</div>
                      <div className="text-xs text-muted">Win Rate</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold" style={{ color: (e.totalPnL ?? 0) >= 0 ? '#06d6a0' : '#ef476f' }}>
                        {(e.totalPnL ?? 0) >= 0 ? '+' : ''}${e.totalPnL?.toFixed(0)}
                      </div>
                      <div className="text-xs text-muted">PnL ({e.nSignals} signals)</div>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="param-tag">Range: {(e.params.impliedRange[0] * 100).toFixed(0)}–{(e.params.impliedRange[1] * 100).toFixed(0)}%</span>
                  <span className="param-tag">Min Trade: ${e.params.minTradeUSD}</span>
                  <span className="param-tag">Kelly: {e.params.kellyFraction}</span>
                  <span className="param-tag">Skip: {e.params.skipCategories.join(', ') || 'none'}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Hypothesis Improvement Chart */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-4">Hypothesis Evolution</h2>
        <p className="text-sm text-muted mb-4">Each wave tests a new hypothesis. The chart shows how PnL improved across experiments.</p>
        <HypothesisChart data={hypothesisData as typeof hypothesisData} />
      </section>

      {/* Charts grid */}
      <section className="mb-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <BrierOverTime experiments={experiments} />
        <ResultDistribution experiments={experiments} />
        <WinRatevsBrier experiments={experiments} />
        <ImpliedRangeMap experiments={experiments} />
      </section>

      <section className="mb-10">
        <TradeUSDImpact experiments={experiments} />
      </section>

      {/* Top 10 experiments table */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-4">Top 10 Experiments by Brier Score</h2>
        <div className="card overflow-auto" style={{ maxHeight: '480px' }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 text-muted font-medium">#</th>
                <th className="text-left py-2 px-3 text-muted font-medium">Result</th>
                <th className="text-right py-2 px-3 text-muted font-medium">Brier</th>
                <th className="text-right py-2 px-3 text-muted font-medium">Win Rate</th>
                <th className="text-right py-2 px-3 text-muted font-medium">PnL</th>
                <th className="text-right py-2 px-3 text-muted font-medium">Signals</th>
                <th className="text-left py-2 px-3 text-muted font-medium">Range</th>
                <th className="text-right py-2 px-3 text-muted font-medium">Min $</th>
                <th className="text-left py-2 px-3 text-muted font-medium">Note</th>
              </tr>
            </thead>
            <tbody>
              {scored
                .sort((a, b) => (a.brierScore ?? 1) - (b.brierScore ?? 1))
                .slice(0, 10)
                .map((e, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-surface2/50">
                    <td className="py-2 px-3 text-muted">{i + 1}</td>
                    <td className="py-2 px-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold"
                        style={{ background: e.result === 'IMPROVED' ? '#06d6a020' : '#ef476f20', color: e.result === 'IMPROVED' ? '#06d6a0' : '#ef476f' }}>
                        {e.result}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-accent">{e.brierScore?.toFixed(4)}</td>
                    <td className="py-2 px-3 text-right">{e.winRate ? ((e.winRate) * 100).toFixed(1) + '%' : '—'}</td>
                    <td className="py-2 px-3 text-right" style={{ color: (e.totalPnL ?? 0) >= 0 ? '#06d6a0' : '#ef476f' }}>
                      {e.totalPnL !== undefined ? ((e.totalPnL >= 0 ? '+' : '') + '$' + e.totalPnL.toFixed(0)) : '—'}
                    </td>
                    <td className="py-2 px-3 text-right text-muted">{e.nSignals ?? '—'}</td>
                    <td className="py-2 px-3 font-mono text-xs">{(e.params.impliedRange[0] * 100).toFixed(0)}–{(e.params.impliedRange[1] * 100).toFixed(0)}%</td>
                    <td className="py-2 px-3 text-right font-mono text-xs">${e.params.minTradeUSD}</td>
                    <td className="py-2 px-3 text-xs text-muted max-w-[200px] truncate">{e.note}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* What the system learned */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-4">🧠 What The System Learned</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { icon: '🎯', title: 'High confidence only', body: 'Only signals with 65–100% implied probability have real edge. Below 65% = noise. The current best config uses 65–100%.' },
            { icon: '💰', title: 'Smaller size filter works better', body: 'Lowering minTradeUSD from $400 → $200 improved Brier score. More signals at $200 threshold gives better calibration data.' },
            { icon: '🚫', title: 'Skip "other" category', body: 'Sports NCAAB/NCAAW game winners is the signal source. Skipping crypto, politics, and other categories removes noise.' },
          ].map((item, i) => (
            <div key={i} className="card">
              <div className="text-3xl mb-3">{item.icon}</div>
              <h3 className="font-semibold mb-2">{item.title}</h3>
              <p className="text-sm text-muted leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
