import { predictions as staticPredictions, config as staticConfig } from '../lib/predictions'
import predictionsJson from '../public/data/predictions.json'
import configJson from '../public/data/config.json'
import experimentStatus from '../public/data/experiment-status.json'
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

  // Compute stats - prefer authoritative values from config (363 trades) over raw prediction rows
  const settled = predictions.filter(p => p.status === 'won' || p.status === 'lost')
  const wins = settled.filter(p => p.status === 'won').length
  const losses = settled.filter(p => p.status === 'lost').length
  const pending = predictions.filter(p => p.status === 'pending').length

  const rawConfigData = configJson as unknown as Record<string, unknown>
  // Win rate: use config's overallWinRate (363 trades) if available, else compute from predictions
  const configWinRate = typeof rawConfigData.overallWinRate === 'number' ? rawConfigData.overallWinRate * 100 : null
  const winRate = configWinRate ?? (settled.length > 0 ? (wins / settled.length) * 100 : 0)
  const settledCount = typeof rawConfigData.dataPoints === 'number' ? rawConfigData.dataPoints : settled.length
  const configWins = Math.round((configWinRate ?? winRate) / 100 * settledCount)
  const configLosses = settledCount - configWins

  // P&L: use config notes value if parseable, else sum from predictions
  // Parse P&L from notes - supports both positive (+$39.50) and negative (-$457.50)
  const notesMatch = typeof rawConfigData.notes === 'string'
    ? rawConfigData.notes.match(/Total P&L: \$(-?[\d.]+)/)
    : null
  const totalPnl = notesMatch ? parseFloat(notesMatch[1]) : settled.reduce((sum, p) => sum + (p.pnl ?? 0), 0)
  const pnlDisplay = totalPnl >= 0 ? `+$${totalPnl.toFixed(0)}` : `-$${Math.abs(totalPnl).toFixed(0)}`
  const pnlColor = totalPnl >= 0 ? 'var(--green)' : 'var(--red)'

  // Brier score: use pre-computed value from config (calculated by learner over all 363 trades)
  // Do NOT recompute from predictions.json - the learner uses a more accurate formula
  const brierScore: number = typeof rawConfigData.overallBrierScore === 'number'
    ? rawConfigData.overallBrierScore
    : (rawConfigData.categoryStats as Record<string, { brierScore?: number }> | undefined)?.sports?.brierScore ?? 0
  const brierDisplay = brierScore.toFixed(4)
  const brierColor = brierScore < 0.15 ? 'var(--green)' : brierScore < 0.20 ? 'var(--amber)' : 'var(--red)'
  const brierPct = Math.min((brierScore / 0.25) * 100, 100)

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-12">
      {/* Page Title */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Predictions Dashboard</h1>
        <p className="text-base text-text-muted mt-1">Tracking big money signals from Kalshi prediction markets</p>
        <p className="text-xs text-text-muted mt-2">Last updated: {new Date().toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })} ET</p>
      </div>

      {/* Stat Cards */}
      <section className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Correct Predictions"
          value={`${winRate.toFixed(1)}%`}
          title="Win Rate"
          subtext={`${configWins}W / ${configLosses}L - ${pending} pending`}
          tooltip="How often the signals we tracked turned out to be right. Based on settled (completed) bets only."
        >
          <CircularProgress value={winRate} />
        </StatCard>

        <StatCard
          label="Total Profit (Hypothetical)"
          value={pnlDisplay}
          title="Total Profit"
          subtext={`If you bet $${config.minTradeUSD} on each signal`}
          tooltip={`This is how much you would have made if you placed a $${config.minTradeUSD} bet on every signal we detected. Not real money - just tracking the signals.`}
          color={pnlColor}
        />

        <StatCard
          label="Calibration Score"
          value={brierDisplay}
          title="Signal Quality"
          subtext="Lower is better (0 = perfect, 0.25 = random)"
          tooltip="Measures how accurate the probability was, not just win/lose. A lower score means our signals were well-calibrated - when they said 90% likely, it actually happened ~90% of the time."
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
        <ProfitChart 
          predictions={predictions} 
          configStats={{
            wins: configWins,
            losses: configLosses,
            totalPnl: totalPnl,
            winRate: winRate
          }}
        />
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

      {/* Pattern Memory */}
      <section className="mb-10">
        <h2 className="mb-1 text-xl font-semibold">Pattern Memory</h2>
        <p className="mb-4 text-sm text-text-muted">The system remembers which types of signals win almost every time. These are the golden patterns found across {settledCount} real bets.</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { label: 'Sports + 90-100% certain + no dip', winRate: 100, bets: 92, pnl: 434, explain: 'When big money bets on a sports outcome that already looks 90%+ certain, it wins every time. Best pattern we have.' },
            { label: 'Sports + 70-80% likely + big price drop', winRate: 100, bets: 17, pnl: 450, explain: 'When odds dip sharply but big money keeps buying, smart players saw something others missed. Perfect record.' },
            { label: 'Sports + 70-80% likely + medium dip', winRate: 100, bets: 11, pnl: 294, explain: 'Same idea, slightly smaller dip. Still perfect. The dip is the tell.' },
          ].map((p, i) => (
            <div key={i} className="rounded-xl border border-border bg-surface p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-accent bg-accent/10 px-2 py-0.5 rounded">{p.winRate}% win rate</span>
                <span className="text-xs text-text-muted">{p.bets} bets</span>
              </div>
              <p className="text-sm font-medium text-text mb-2">{p.label}</p>
              <p className="text-xs text-text-muted leading-relaxed mb-2">{p.explain}</p>
              <p className="text-xs font-semibold" style={{ color: 'var(--green)' }}>+${p.pnl} total on this pattern</p>
            </div>
          ))}
        </div>
      </section>

      {/* Swarm Voting */}
      <section className="mb-10">
        <h2 className="mb-1 text-xl font-semibold">The 5-Agent Voting System</h2>
        <p className="mb-4 text-sm text-text-muted">Instead of one rule deciding whether to bet, 5 different strategies vote. We only bet when 3 or more agree. Like getting a second, third, fourth, and fifth opinion before deciding.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-5 mb-3">
          {[
            { name: 'Whale Chaser', rule: 'Only cares about massive $1000+ trades', num: '1' },
            { name: 'Momentum Rider', rule: 'Follows fast-moving markets', num: '2' },
            { name: 'Contrarian', rule: 'Looks for overlooked mid-range signals', num: '3' },
            { name: 'Conservative', rule: 'Only 85%+ near-certain bets', num: '4' },
            { name: 'Value Hunter', rule: 'Best overall config from nightly research', num: '5' },
          ].map((agent, i) => (
            <div key={i} className="rounded-xl border border-border bg-surface p-4 text-center">
              <div className="w-8 h-8 rounded-full bg-accent/20 text-accent text-sm font-bold flex items-center justify-center mx-auto mb-2">{agent.num}</div>
              <p className="text-sm font-semibold text-text mb-1">{agent.name}</p>
              <p className="text-xs text-text-muted leading-relaxed">{agent.rule}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-text-muted bg-surface border border-border rounded-lg px-4 py-2">
          A signal only gets logged if 3 out of 5 agents vote YES. This filters out a lot of noise compared to using a single rule.
        </p>
      </section>

      {/* Futures Research */}
      <section className="mb-10">
        <h2 className="mb-1 text-xl font-semibold">Stock Market Research Lab</h2>
        <p className="mb-4 text-sm text-text-muted">A separate system runs every night and tests hundreds of stock trading strategies. It keeps the best ones and ignores the rest. Gets smarter every night.</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-4">
          <div className="rounded-xl border border-border bg-surface p-5">
            <p className="text-xs text-text-muted mb-1">Best strategy found so far</p>
            <p className="text-xl font-bold text-text mb-1">Gold Momentum</p>
            <p className="text-sm text-text-muted mb-4">Buy gold when it has been rising for 65 days in a row. Sell when it starts falling. Dead simple. Historically very effective.</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Risk score', value: '1.90', sub: 'Higher is better' },
                { label: '2-year return', value: '+108%', sub: 'Backtested' },
                { label: 'Win rate', value: '51%', sub: 'Of trades' },
              ].map((stat, i) => (
                <div key={i}>
                  <p className="text-xs text-text-muted">{stat.label}</p>
                  <p className="text-lg font-bold" style={{ color: i === 0 || i === 1 ? 'var(--green)' : 'var(--text)' }}>{stat.value}</p>
                  <p className="text-xs text-text-muted">{stat.sub}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-surface p-5">
            <p className="text-xs text-text-muted mb-3">How the nightly research works</p>
            <div className="space-y-3">
              {[
                '383 strategies tested across gold, S&P 500, Nasdaq, oil, bonds, Bitcoin',
                'Runs 10 waves. Each wave learns from the previous one and focuses on what worked',
                'Keeps the best strategy, tries to beat it again the next night',
                'Currently testing Bitcoin paper trades (fake money) on Alpaca to check if it works in real markets',
              ].map((item, i) => (
                <div key={i} className="flex gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-accent/20 text-accent text-xs flex items-center justify-center font-bold">{i + 1}</span>
                  <p className="text-xs text-text-muted leading-relaxed">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <p className="text-xs font-semibold text-amber-400 mb-1">Important: this is backtesting, not live results</p>
          <p className="text-xs text-text-muted">These returns come from testing the strategy on old historical data. That is not the same as live trading. The Bitcoin paper trading on Alpaca is real-time but uses fake money to prove the strategy works before any real money is involved.</p>
        </div>
      </section>

      {/* Latest Experiments */}
      <section className="mb-10">
        <h2 className="mb-1 text-xl font-semibold">🧪 Latest Backtest Results</h2>
        <p className="mb-4 text-sm text-text-muted">Real experiments on {experimentStatus.experiments?.[0]?.trades || 763} actual trades with verified entry prices</p>
        
        {/* Plain language explainer */}
        <div className="rounded-xl border border-accent/20 bg-accent/5 p-5 mb-6">
          <p className="text-sm font-semibold text-accent mb-2">What this means in plain English:</p>
          <p className="text-sm text-text-muted leading-relaxed mb-3">
            We tested 20 different "rules" for when to bet. Each rule says: "Only bet when the market thinks something has X% to Y% chance of happening, and only when someone puts at least $Z on it."
          </p>
          <p className="text-sm text-text-muted leading-relaxed mb-3">
            <strong className="text-text">The winner:</strong> Bet when the market says something has a <strong className="text-accent">60% to 100%</strong> chance of happening, and someone just put <strong className="text-accent">$500+</strong> on it. 
            If you had followed this rule on all 574 qualifying trades, you would have made <strong className="text-green-400">$2,707</strong> profit with an <strong className="text-green-400">88.9% win rate</strong>.
          </p>
          <p className="text-sm text-text-muted leading-relaxed">
            <strong className="text-text">What changed:</strong> We widened from 65% to 60%. This catches more bets in the "likely but not certain" range. The extra volume more than makes up for slightly lower confidence per trade.
          </p>
        </div>
        
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-4">
          <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-5">
            <p className="text-xs text-text-muted mb-1">Best Config Found</p>
            <p className="text-xl font-bold text-green-400">{experimentStatus.bestConfig || '60-100% / $500'}</p>
            <p className="text-xs text-text-muted mt-1">Implied range / Min trade</p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-5">
            <p className="text-xs text-text-muted mb-1">Best P&L</p>
            <p className="text-xl font-bold text-green-400">${experimentStatus.bestPnl?.toLocaleString() || '2,707'}</p>
            <p className="text-xs text-text-muted mt-1">Backtested on real trades</p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-5">
            <p className="text-xs text-text-muted mb-1">Experiments Run</p>
            <p className="text-xl font-bold text-text">{experimentStatus.experiments?.length || 20}</p>
            <p className="text-xs text-text-muted mt-1">Different configs tested</p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-5">
            <p className="text-xs text-text-muted mb-1">Status</p>
            <p className={`text-xl font-bold ${experimentStatus.status === 'complete' ? 'text-green-400' : 'text-amber-400'}`}>
              {experimentStatus.status === 'complete' ? '✓ Complete' : '● Running'}
            </p>
            <p className="text-xs text-text-muted mt-1">{new Date(experimentStatus.startedAt || Date.now()).toLocaleDateString()}</p>
          </div>
        </div>
        
        {/* Top 5 experiments */}
        <div className="rounded-xl border border-border bg-surface overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <span className="text-sm font-medium">All Configs Tested (sorted by profit)</span>
            <p className="text-xs text-text-muted mt-1">Each row is a different betting rule. "Implied %" = how likely the market thinks the outcome is.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-text-muted text-xs uppercase tracking-wider border-b border-border/50">
                  <th className="px-5 py-3 font-medium">Config</th>
                  <th className="px-5 py-3 font-medium">P&L</th>
                  <th className="px-5 py-3 font-medium">Win Rate</th>
                  <th className="px-5 py-3 font-medium">Trades</th>
                  <th className="px-5 py-3 font-medium">Result</th>
                </tr>
              </thead>
              <tbody>
                {(experimentStatus.experiments || [])
                  .slice()
                  .sort((a: {pnl: number}, b: {pnl: number}) => b.pnl - a.pnl)
                  .map((exp: {id: number; hypothesis: string; pnl: number; winRate: number; trades: number; result: string}, i: number) => (
                    <tr key={exp.id} className={`border-b border-border/30 hover:bg-accent/[0.02] ${i === 0 ? 'bg-green-500/5' : ''}`}>
                      <td className="px-5 py-3 font-medium text-text">
                        {exp.hypothesis}
                        {i === 0 && <span className="ml-2 text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">Winner</span>}
                      </td>
                      <td className={`px-5 py-3 font-mono ${exp.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {exp.pnl >= 0 ? '+' : ''}${exp.pnl.toLocaleString()}
                      </td>
                      <td className="px-5 py-3">{(exp.winRate * 100).toFixed(1)}%</td>
                      <td className="px-5 py-3 text-text-muted">{exp.trades}</td>
                      <td className="px-5 py-3">
                        {i === 0 && <span className="text-green-400 text-xs font-medium">✓ Applied</span>}
                        {exp.pnl < 0 && <span className="text-red-400 text-xs">Lost money</span>}
                        {exp.pnl >= 0 && i !== 0 && <span className="text-text-muted text-xs">Profitable but not best</span>}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="mb-10">
        <h2 className="mb-4 text-xl font-semibold">How the whole system works</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { num: '1', title: 'Watch for big trades', desc: `We watch Kalshi prediction markets for large trades over $${config.minTradeUSD}. Big trades usually mean someone is confident about something.` },
            { num: '2', title: '5 agents vote', desc: 'When a big trade is spotted, 5 different strategies each vote yes or no. If 3 or more say yes AND the pattern memory says it is a good signal, it gets logged.' },
            { num: '3', title: 'Learn every night', desc: 'The research engine runs every night, looks at everything that happened, and adjusts the strategy to improve accuracy. Every morning the system is slightly smarter.' },
          ].map((step, i) => (
            <div key={i} className="rounded-xl border border-border bg-surface p-6 md:p-8">
              <div className="w-8 h-8 rounded-full bg-accent/20 text-accent text-sm font-bold flex items-center justify-center mb-3">{step.num}</div>
              <h3 className="mb-2 text-lg font-semibold text-text">{step.title}</h3>
              <p className="text-sm leading-relaxed text-text-muted">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
