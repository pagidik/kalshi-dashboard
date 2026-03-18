import Link from 'next/link'
import { getAccount, getPositions, getOrders, getPortfolioHistory } from '../../lib/alpaca'
import StockCharts from '../../components/StockCharts'

interface SMCSignal {
  symbol: string
  direction: 'LONG' | 'SHORT'
  entry: number
  stop: number
  target: number
  rr: number
  setup: string
  timestamp: string
  near_fvg?: boolean
  near_ob?: boolean
}

interface SMCState {
  signals: SMCSignal[]
  trades: Array<{
    symbol: string
    direction: string
    entry: number
    stop: number
    target: number
    rr: number
    order_id: string
    timestamp: string
    status: string
  }>
  last_scan: string
  stats: {
    wins: number
    losses: number
    total_pnl: number
  }
  watchlist?: string[]
  note?: string
  strategy?: {
    name: string
    rr_min: number
    stop_pct: number
    target_pct: number
    max_positions: number
    position_size_pct: number
  }
}

async function getSMCState(): Promise<SMCState | null> {
  try {
    // In production, read from public/data. Locally, try the scripts folder first.
    if (process.env.NODE_ENV === 'production') {
      const stateData = await import('../../public/data/smc-state.json')
      return stateData.default as unknown as SMCState
    }
    const fs = await import('fs/promises')
    const path = 'C:\\Users\\kisho\\clawd\\scripts\\alpaca-smc-state.json'
    const data = await fs.readFile(path, 'utf-8')
    return JSON.parse(data)
  } catch {
    // Fallback to bundled data
    try {
      const stateData = await import('../../public/data/smc-state.json')
      return stateData.default as unknown as SMCState
    } catch {
      return null
    }
  }
}

export default async function StocksPage() {
  let account = null
  let positions: Awaited<ReturnType<typeof getPositions>> = []
  let orders: Awaited<ReturnType<typeof getOrders>> = []
  let portfolioHistory = null
  let smcState: SMCState | null = null
  let error: string | null = null

  try {
    ;[account, positions, orders, portfolioHistory, smcState] = await Promise.all([
      getAccount(),
      getPositions(),
      getOrders('all', 50),
      getPortfolioHistory('1M', '1D'),
      getSMCState(),
    ])
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to fetch data'
  }

  const equity = account ? parseFloat(account.equity) : 0
  const buyingPower = account ? parseFloat(account.buying_power) : 0
  const cash = account ? parseFloat(account.cash) : 0
  
  const totalPnl = positions.reduce((sum, p) => sum + parseFloat(p.unrealized_pl), 0)
  const winningPositions = positions.filter(p => parseFloat(p.unrealized_pl) > 0).length
  const losingPositions = positions.filter(p => parseFloat(p.unrealized_pl) < 0).length

  const filledOrders = orders.filter(o => o.status === 'filled')
  const pendingOrders = orders.filter(o => o.status === 'new' || o.status === 'accepted' || o.status === 'pending_new')

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-12">
      {/* Header */}
      <div className="flex items-center gap-4 mb-2">
        <Link href="/" className="text-sm text-muted hover:text-accent transition-colors">Back to Kalshi</Link>
      </div>
      <header className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Stock Analyzer</h1>
          <span className="flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-400">
            Paper Trading
          </span>
        </div>
        <p className="text-base text-text-muted">SMC/ICT swing trading signals on Alpaca paper account</p>
        <p className="text-xs text-text-muted mt-1">
          Last scan: {smcState?.last_scan ? new Date(smcState.last_scan).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' ET' : 'Never'}
        </p>
      </header>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Account Stats */}
      <section className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="card text-center">
          <div className="text-2xl font-bold text-accent">${equity.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
          <div className="text-xs text-text-muted mt-1">Total Equity</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold" style={{ color: totalPnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {totalPnl >= 0 ? '+' : ''}{totalPnl.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
          </div>
          <div className="text-xs text-text-muted mt-1">Unrealized P&L</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-text">{positions.length}</div>
          <div className="text-xs text-text-muted mt-1">Open Positions</div>
          <div className="text-xs mt-1">
            <span style={{ color: 'var(--green)' }}>{winningPositions}W</span>
            {' / '}
            <span style={{ color: 'var(--red)' }}>{losingPositions}L</span>
          </div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-text">${buyingPower.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
          <div className="text-xs text-text-muted mt-1">Buying Power</div>
        </div>
      </section>

      {/* Portfolio Chart */}
      {portfolioHistory && (
        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-4">Equity Curve</h2>
          <StockCharts portfolioHistory={portfolioHistory} />
        </section>
      )}

      {/* Active Signals */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-4">Active SMC Signals</h2>
        {smcState?.signals && smcState.signals.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {smcState.signals.map((signal, i) => (
              <div key={i} className="card border-l-4" style={{ borderLeftColor: signal.direction === 'LONG' ? 'var(--green)' : 'var(--red)' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-lg font-bold text-text">{signal.symbol}</span>
                  <span className="px-2 py-0.5 rounded text-xs font-bold" style={{ 
                    background: signal.direction === 'LONG' ? 'rgba(6, 214, 160, 0.2)' : 'rgba(239, 71, 111, 0.2)',
                    color: signal.direction === 'LONG' ? '#06d6a0' : '#ef476f'
                  }}>
                    {signal.direction}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center mb-3">
                  <div>
                    <div className="text-xs text-text-muted">Entry</div>
                    <div className="text-sm font-mono">${signal.entry.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-text-muted">Stop</div>
                    <div className="text-sm font-mono" style={{ color: 'var(--red)' }}>${signal.stop.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-text-muted">Target</div>
                    <div className="text-sm font-mono" style={{ color: 'var(--green)' }}>${signal.target.toFixed(2)}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-muted">{signal.setup.replace(/_/g, ' ')}</span>
                  <span className="font-bold text-accent">{signal.rr.toFixed(1)}:1 R:R</span>
                </div>
                <div className="flex gap-2 mt-2">
                  {signal.near_fvg && <span className="text-xs px-2 py-0.5 rounded bg-accent/10 text-accent">FVG</span>}
                  {signal.near_ob && <span className="text-xs px-2 py-0.5 rounded bg-accent/10 text-accent">OB</span>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card py-6">
            <div className="text-center mb-4">
              <p className="text-lg font-semibold text-text mb-2">Waiting for Setup</p>
              <p className="text-sm text-text-muted">{smcState?.note || 'No liquidity sweeps detected with FVG/OB confluence.'}</p>
            </div>
            {smcState?.watchlist && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs text-text-muted mb-2 text-center">Watching:</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {smcState.watchlist.map((sym, i) => (
                    <span key={i} className="px-2 py-1 rounded bg-surface2 text-xs font-mono">{sym}</span>
                  ))}
                </div>
              </div>
            )}
            {smcState?.strategy && (
              <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                <div>
                  <div className="text-xs text-text-muted">Min R:R</div>
                  <div className="text-sm font-bold text-accent">{smcState.strategy.rr_min}:1</div>
                </div>
                <div>
                  <div className="text-xs text-text-muted">Stop Loss</div>
                  <div className="text-sm font-bold" style={{ color: 'var(--red)' }}>{(smcState.strategy.stop_pct * 100).toFixed(0)}%</div>
                </div>
                <div>
                  <div className="text-xs text-text-muted">Take Profit</div>
                  <div className="text-sm font-bold" style={{ color: 'var(--green)' }}>{(smcState.strategy.target_pct * 100).toFixed(0)}%</div>
                </div>
                <div>
                  <div className="text-xs text-text-muted">Max Positions</div>
                  <div className="text-sm font-bold text-text">{smcState.strategy.max_positions}</div>
                </div>
                <div>
                  <div className="text-xs text-text-muted">Position Size</div>
                  <div className="text-sm font-bold text-text">{(smcState.strategy.position_size_pct * 100).toFixed(0)}%</div>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Open Positions */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-4">Open Positions</h2>
        {positions.length > 0 ? (
          <div className="card overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-muted font-medium">Symbol</th>
                  <th className="text-right py-2 px-3 text-muted font-medium">Qty</th>
                  <th className="text-right py-2 px-3 text-muted font-medium">Avg Entry</th>
                  <th className="text-right py-2 px-3 text-muted font-medium">Current</th>
                  <th className="text-right py-2 px-3 text-muted font-medium">P&L</th>
                  <th className="text-right py-2 px-3 text-muted font-medium">%</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((pos, i) => {
                  const pl = parseFloat(pos.unrealized_pl)
                  const plPct = parseFloat(pos.unrealized_plpc) * 100
                  return (
                    <tr key={i} className="border-b border-border/50 hover:bg-surface2/50">
                      <td className="py-2 px-3 font-semibold">{pos.symbol}</td>
                      <td className="py-2 px-3 text-right">{pos.qty}</td>
                      <td className="py-2 px-3 text-right font-mono">${parseFloat(pos.avg_entry_price).toFixed(2)}</td>
                      <td className="py-2 px-3 text-right font-mono">${parseFloat(pos.current_price).toFixed(2)}</td>
                      <td className="py-2 px-3 text-right font-mono" style={{ color: pl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {pl >= 0 ? '+' : ''}{pl.toFixed(2)}
                      </td>
                      <td className="py-2 px-3 text-right" style={{ color: plPct >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {plPct >= 0 ? '+' : ''}{plPct.toFixed(2)}%
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="card text-center py-8">
            <p className="text-text-muted">No open positions.</p>
          </div>
        )}
      </section>

      {/* Recent Orders */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-4">Recent Orders</h2>
        {orders.length > 0 ? (
          <div className="card overflow-auto" style={{ maxHeight: '400px' }}>
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface">
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-muted font-medium">Symbol</th>
                  <th className="text-left py-2 px-3 text-muted font-medium">Side</th>
                  <th className="text-right py-2 px-3 text-muted font-medium">Qty</th>
                  <th className="text-left py-2 px-3 text-muted font-medium">Type</th>
                  <th className="text-left py-2 px-3 text-muted font-medium">Status</th>
                  <th className="text-right py-2 px-3 text-muted font-medium">Fill Price</th>
                  <th className="text-left py-2 px-3 text-muted font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {orders.slice(0, 20).map((order, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-surface2/50">
                    <td className="py-2 px-3 font-semibold">{order.symbol}</td>
                    <td className="py-2 px-3">
                      <span style={{ color: order.side === 'buy' ? 'var(--green)' : 'var(--red)' }}>
                        {order.side.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right">{order.qty}</td>
                    <td className="py-2 px-3 text-text-muted">{order.type}</td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        order.status === 'filled' ? 'bg-green/20 text-green' :
                        order.status === 'canceled' ? 'bg-red/20 text-red' :
                        'bg-amber-500/20 text-amber-400'
                      }`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-mono">
                      {order.filled_avg_price ? `$${parseFloat(order.filled_avg_price).toFixed(2)}` : '-'}
                    </td>
                    <td className="py-2 px-3 text-text-muted text-xs">
                      {new Date(order.submitted_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="card text-center py-8">
            <p className="text-text-muted">No orders yet.</p>
          </div>
        )}
      </section>

      {/* Strategy Explanation */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-4">SMC/ICT Strategy</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { num: '1', title: 'Liquidity Sweep', desc: 'Wait for price to take out a swing high or low, triggering stop losses. This is where smart money accumulates.' },
            { num: '2', title: 'Market Structure Shift', desc: 'After the sweep, look for a break of structure confirming the reversal. This signals smart money has finished accumulating.' },
            { num: '3', title: 'FVG/OB Entry', desc: 'Enter on the retest of a Fair Value Gap or Order Block. This gives tight stops and high R:R setups.' },
          ].map((step, i) => (
            <div key={i} className="card">
              <div className="w-8 h-8 rounded-full bg-accent/20 text-accent text-sm font-bold flex items-center justify-center mb-3">{step.num}</div>
              <h3 className="mb-2 text-lg font-semibold text-text">{step.title}</h3>
              <p className="text-sm leading-relaxed text-text-muted">{step.desc}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 card">
          <p className="text-sm text-text-muted">
            <strong className="text-text">Risk Management:</strong> 3:1 minimum R:R ratio. 5% stop loss, 15% take profit. Max 3 concurrent positions. 10% of portfolio per trade.
          </p>
        </div>
      </section>
    </div>
  )
}
