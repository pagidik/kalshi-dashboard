import Link from 'next/link'
import { predictions as staticPredictions, config as staticConfig } from '../lib/predictions'
import predictionsJson from '../public/data/predictions.json'
import configJson from '../public/data/config.json'
import StatCard from '../components/StatCard'
import CircularProgress from '../components/CircularProgress'
import ProfitChart from '../components/ProfitChart'
import PredictionTable from '../components/PredictionTable'
import CategoryCard from '../components/CategoryCard'

function getLiveData() {
  try {
    const predictions = predictionsJson as typeof staticPredictions
    const config = configJson as unknown as typeof staticConfig
    return { predictions, config }
  } catch {
    return { predictions: staticPredictions, config: staticConfig }
  }
}

export default async function Home() {
  const { predictions, config } = await getLiveData()
  const sports = predictions.filter(p => p.category === 'sports')
  const crypto = predictions.filter(p => p.category === 'crypto')
  const other = predictions.filter(p => p.category === 'other')
  const rawConfig = configJson as unknown as Record<string, unknown>
  const kellyBet = rawConfig.kellyBet ?? (rawConfig.categoryStats as Record<string, unknown> | undefined)?.sports ?? config.minTradeUSD
  const kellyDisplay = typeof kellyBet === 'number' ? kellyBet : (kellyBet as Record<string, unknown>)?.kellyBet ?? config.minTradeUSD

  // Compute stats dynamically
  const settled = predictions.filter(p => p.status === 'won' || p.status === 'lost')
  const wins = settled.filter(p => p.status === 'won').length
  const losses = settled.filter(p => p.status === 'lost').length
  const pending = predictions.filter(p => p.status === 'pending').length
  const winRate = settled.length > 0 ? (wins / settled.length) * 100 : 0
  const totalPnl = settled.reduce((sum, p) => sum + (p.pnl ?? 0), 0)
  const pnlDisplay = totalPnl >= 0 ? `+$${totalPnl.toFixed(0)}` : `-$${Math.abs(totalPnl).toFixed(0)}`
  const pnlColor = totalPnl >= 0 ? 'var(--green)' : 'var(--red)'

  // Brier score: mean((predicted_prob - outcome)^2) over settled bets with known result
  const brierBets = settled.filter(p => p.result !== null && p.price !== null)
  const brierScore = brierBets.length > 0
    ? brierBets.reduce((sum, p) => {
        const outcome = p.result === 'yes' ? 1 : 0
        return sum + Math.pow((p.price ?? 0) - outcome, 2)
      }, 0) / brierBets.length
    : 0
  const brierDisplay = brierScore.toFixed(3)
  const brierColor = brierScore < 0.15 ? 'var(--green)' : brierScore < 0.20 ? 'var(--amber)' : 'var(--red)'
  const brierPct = Math.min((brierScore / 0.25) * 100, 100)

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-12">
      {/* Header */}
      <header className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Kalshi Predictions</h1>
          <span className="flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
            <span className="inline-block h-2 w-2 rounded-full bg-accent animate-pulse-glow" />
            Live
          </span>
        </div>
        <p className="text-base text-text-muted">Tracking big money signals from Kalshi prediction markets</p>
        <div className="flex items-center gap-4 mt-2">
          <p className="text-xs text-text-muted">Last updated: {new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}</p>
          <Link href="/experiments" className="text-xs px-3 py-1 rounded-full border transition-colors hover:opacity-80" style={{ borderColor: 'rgba(0,255,212,0.3)', color: 'var(--accent)', background: 'rgba(0,255,212,0.06)' }}>
            🧪 Autoresearch Lab →
          </Link>
        </div>
      </header>

      {/* Stat Cards */}
      <section className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Correct Predictions"
          value={`${winRate.toFixed(1)}%`}
          title="Win Rate"
          subtext={`${wins}W / ${losses}L — ${pending} pending`}
          tooltip="How often the signals we tracked turned out to be right. Based on settled (completed) bets only."
        >
          <CircularProgress value={winRate} />
        </StatCard>

        <StatCard
          label="Total Profit (Hypothetical)"
          value={pnlDisplay}
          title="Total Profit"
          subtext={`If you bet $${config.minTradeUSD} on each signal`}
          tooltip={`This is how much you would have made if you placed a $${config.minTradeUSD} bet on every signal we detected. Not real money — just tracking the signals.`}
          color={pnlColor}
        />

        <StatCard
          label="Calibration Score"
          value={brierDisplay}
          title="Signal Quality"
          subtext="Lower is better (0 = perfect, 0.25 = random)"
          tooltip="Measures how accurate the probability was, not just win/lose. A lower score means our signals were well-calibrated — when they said 90% likely, it actually happened ~90% of the time."
          color={brierColor}
        >
          <div className="flex flex-col items-end gap-1">
            <div className="relative h-2 w-20 rounded-full bg-surface2">
              <div className="absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-green border-2 border-bg" style={{ left: `${brierPct}%` }} />
            </div>
            <div className="flex justify-between w-20 text-[9px] text-text-muted">
              <span>0</span>
              <span>0.25</span>
            </div>
          </div>
        </StatCard>

        <StatCard
          label="Smart Bet Size"
          value={`$${kellyDisplay}`}
          title="Recommended Bet"
          subtext="Based on Kelly Criterion math"
          tooltip="The mathematically optimal amount to bet per signal, based on our observed win rate and the odds. Uses a conservative formula called Half-Kelly to avoid overbetting."
        />
      </section>

      {/* Profit Chart */}
      <section className="mb-10 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
        <ProfitChart predictions={predictions} />
      </section>

      {/* Predictions Table */}
      <section className="mb-10 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
        <PredictionTable predictions={predictions} />
      </section>

      {/* Category Breakdown */}
      <section className="mb-10">
        <h2 className="mb-4 text-xl font-semibold">Sports vs Crypto</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <CategoryCard title="Sports" predictions={sports} />
          <CategoryCard title="Crypto" predictions={crypto} />
          <CategoryCard title="Other" predictions={other} />
        </div>
      </section>

      {/* How It Works */}
      <section className="mb-10">
        <h2 className="mb-4 text-xl font-semibold">How It Works</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { icon: '🔍', title: 'Watch for big trades', desc: `We watch Kalshi markets for unusually large trades (over $${config.minTradeUSD})` },
            { icon: '📊', title: 'Log the signal', desc: 'When big money moves, we log it as a signal' },
            { icon: '📈', title: 'Track accuracy', desc: 'We track if the signal was right, and learn over time' },
          ].map((step, i) => (
            <div key={i} className="rounded-xl border border-border bg-surface p-6 md:p-8">
              <div className="mb-3 text-3xl">{step.icon}</div>
              <h3 className="mb-2 text-lg font-semibold text-text">{step.title}</h3>
              <p className="text-sm leading-relaxed text-text-muted">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
