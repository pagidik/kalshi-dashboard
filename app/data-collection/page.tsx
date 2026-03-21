'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface PriceSnapshot {
  t: string
  yb: number  // yes bid
  ya: number  // yes ask
  v: number   // volume
  oi: number  // open interest
}

interface MarketHistory {
  ticker: string
  eventTicker: string
  seriesTicker: string
  title: string
  closeTime: string
  prices: PriceSnapshot[]
}

interface CollectionStatus {
  status: 'loading' | 'active' | 'error'
  totalMarkets: number
  totalSnapshots: number
  oldestSnapshot: string | null
  newestSnapshot: string | null
  seriesBreakdown: Record<string, number>
  markets: MarketHistory[]
  dataSize: string
  nextCaptureIn: string
}

// Series name mapping
const SERIES_NAMES: Record<string, string> = {
  'KXNCAAMBGAME': 'NCAA Men\'s Basketball',
  'KXNCAAWBGAME': 'NCAA Women\'s Basketball',
  'KXNBAGAME': 'NBA Games',
  'KXNFLGAME': 'NFL Games',
  'KXMLBGAME': 'MLB Games',
  'KXNHLGAME': 'NHL Games',
  'KXNBATOTAL': 'NBA Totals',
  'KXNBATEAMTOTAL': 'NBA Team Totals',
  'KXNBAREB': 'NBA Rebounds',
  'KXNBAPTS': 'NBA Points',
}

function formatTimeAgo(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)
  
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return `${diffDays}d ago`
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

// Mini sparkline component
function Sparkline({ prices }: { prices: PriceSnapshot[] }) {
  if (prices.length < 2) return <span className="text-text-muted text-xs">—</span>
  
  const values = prices.map(p => p.yb)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 0.01
  
  const width = 80
  const height = 24
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width
    const y = height - ((v - min) / range) * height
    return `${x},${y}`
  }).join(' ')
  
  const trend = values[values.length - 1] - values[0]
  const color = trend >= 0 ? '#00ff9f' : '#ff4757'
  
  return (
    <svg width={width} height={height} className="inline-block">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function DataCollectionPage() {
  const [status, setStatus] = useState<CollectionStatus | null>(null)
  const [selectedMarket, setSelectedMarket] = useState<MarketHistory | null>(null)
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/data-collection/status')
        if (res.ok) {
          const data = await res.json()
          setStatus(data)
        }
      } catch (e) {
        console.error('Failed to fetch status:', e)
      }
    }
    
    fetchStatus()
    const interval = setInterval(fetchStatus, 30000) // Refresh every 30s
    return () => clearInterval(interval)
  }, [])

  if (!status) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white p-8 flex items-center justify-center">
        <div className="text-xl animate-pulse">Loading data collection status...</div>
      </div>
    )
  }

  const filteredMarkets = filter === 'all' 
    ? status.markets 
    : status.markets.filter(m => m.seriesTicker === filter)

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Link href="/" className="text-text-muted hover:text-accent transition-colors">← Dashboard</Link>
            </div>
            <h1 className="text-3xl font-bold">📊 Data Collection</h1>
            <p className="text-gray-400 mt-1">Building real entry price dataset for valid backtesting</p>
          </div>
          <div className={`px-4 py-2 rounded-full text-sm font-semibold ${
            status.status === 'active' ? 'bg-green-500/20 text-green-400' :
            status.status === 'error' ? 'bg-red-500/20 text-red-400' :
            'bg-gray-500/20 text-gray-400'
          }`}>
            {status.status === 'active' ? '● COLLECTING' : 
             status.status === 'error' ? '✗ ERROR' : '○ LOADING'}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-[#1a1a2e] rounded-xl p-5">
            <div className="text-gray-400 text-sm mb-1">Markets Tracked</div>
            <div className="text-3xl font-bold text-white">{status.totalMarkets.toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-1">Unique markets with price history</div>
          </div>
          <div className="bg-[#1a1a2e] rounded-xl p-5">
            <div className="text-gray-400 text-sm mb-1">Price Snapshots</div>
            <div className="text-3xl font-bold text-purple-400">{status.totalSnapshots.toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-1">Total price points captured</div>
          </div>
          <div className="bg-[#1a1a2e] rounded-xl p-5">
            <div className="text-gray-400 text-sm mb-1">Data Size</div>
            <div className="text-3xl font-bold text-blue-400">{status.dataSize}</div>
            <div className="text-xs text-gray-500 mt-1">kalshi-price-snapshots.json</div>
          </div>
          <div className="bg-[#1a1a2e] rounded-xl p-5">
            <div className="text-gray-400 text-sm mb-1">Next Capture</div>
            <div className="text-3xl font-bold text-amber-400">{status.nextCaptureIn}</div>
            <div className="text-xs text-gray-500 mt-1">Runs every 15 minutes</div>
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-[#1a1a2e] rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">📅 Collection Timeline</h2>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex justify-between text-xs text-gray-400 mb-2">
                <span>First Snapshot</span>
                <span>Latest Snapshot</span>
              </div>
              <div className="h-3 bg-[#0a0a0f] rounded-full overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/50 to-green-500/50" />
              </div>
              <div className="flex justify-between text-sm mt-2">
                <span className="text-purple-400">{status.oldestSnapshot ? formatDateTime(status.oldestSnapshot) : 'N/A'}</span>
                <span className="text-green-400">{status.newestSnapshot ? formatDateTime(status.newestSnapshot) : 'N/A'}</span>
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-4">
            After ~1 week of collection, we'll have enough real entry prices to run valid backtests. 
            Current data contains pre-settlement prices that can be matched against actual outcomes.
          </p>
        </div>

        {/* Series Breakdown */}
        <div className="bg-[#1a1a2e] rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">🏀 Series Breakdown</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {Object.entries(status.seriesBreakdown).map(([series, count]) => (
              <button
                key={series}
                onClick={() => setFilter(filter === series ? 'all' : series)}
                className={`rounded-lg p-4 text-left transition-all ${
                  filter === series 
                    ? 'bg-accent/20 border border-accent' 
                    : 'bg-[#0a0a0f] border border-transparent hover:border-gray-700'
                }`}
              >
                <div className="text-2xl font-bold text-white">{count}</div>
                <div className="text-xs text-gray-400 truncate">{SERIES_NAMES[series] || series}</div>
              </button>
            ))}
          </div>
          {filter !== 'all' && (
            <button 
              onClick={() => setFilter('all')}
              className="mt-3 text-xs text-accent hover:underline"
            >
              Clear filter
            </button>
          )}
        </div>

        {/* Markets with Price History */}
        <div className="bg-[#1a1a2e] rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">📈 Markets with Price History</h2>
            <span className="text-sm text-gray-400">{filteredMarkets.length} markets</span>
          </div>
          
          <div className="overflow-hidden rounded-lg border border-gray-800">
            <div className="max-h-[500px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[#1a1a2e] z-10">
                  <tr className="text-left text-gray-400 border-b border-gray-800">
                    <th className="py-3 px-4 font-medium">Market</th>
                    <th className="py-3 px-4 font-medium">Series</th>
                    <th className="py-3 px-4 font-medium">Snapshots</th>
                    <th className="py-3 px-4 font-medium">Price Trend</th>
                    <th className="py-3 px-4 font-medium">Last Price</th>
                    <th className="py-3 px-4 font-medium">Close Time</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMarkets.slice(0, 100).map((market) => {
                    const lastPrice = market.prices[market.prices.length - 1]
                    const firstPrice = market.prices[0]
                    const priceChange = lastPrice && firstPrice ? lastPrice.yb - firstPrice.yb : 0
                    
                    return (
                      <tr 
                        key={market.ticker} 
                        className="border-b border-gray-800/50 hover:bg-white/5 cursor-pointer transition-colors"
                        onClick={() => setSelectedMarket(market)}
                      >
                        <td className="py-3 px-4">
                          <div className="font-medium text-white truncate max-w-[250px]">{market.title}</div>
                          <div className="text-xs text-gray-500 truncate">{market.ticker}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded">
                            {SERIES_NAMES[market.seriesTicker]?.split(' ')[0] || market.seriesTicker}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-blue-400 font-medium">{market.prices.length}</span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Sparkline prices={market.prices} />
                            <span className={`text-xs ${priceChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {priceChange >= 0 ? '+' : ''}{(priceChange * 100).toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-mono text-white">
                            {lastPrice ? `$${lastPrice.yb.toFixed(2)}` : '—'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-400">
                          {market.closeTime ? formatTimeAgo(market.closeTime) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
          
          {filteredMarkets.length > 100 && (
            <p className="text-xs text-gray-500 mt-3 text-center">
              Showing first 100 of {filteredMarkets.length} markets
            </p>
          )}
        </div>

        {/* Market Detail Modal */}
        {selectedMarket && (
          <div 
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedMarket(null)}
          >
            <div 
              className="bg-[#1a1a2e] rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-white">{selectedMarket.title}</h3>
                  <p className="text-xs text-gray-400 font-mono mt-1">{selectedMarket.ticker}</p>
                </div>
                <button 
                  onClick={() => setSelectedMarket(null)}
                  className="text-gray-400 hover:text-white text-2xl"
                >
                  ×
                </button>
              </div>
              
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-[#0a0a0f] rounded-lg p-4">
                  <div className="text-gray-400 text-xs">Snapshots</div>
                  <div className="text-2xl font-bold text-blue-400">{selectedMarket.prices.length}</div>
                </div>
                <div className="bg-[#0a0a0f] rounded-lg p-4">
                  <div className="text-gray-400 text-xs">Latest Price</div>
                  <div className="text-2xl font-bold text-green-400">
                    ${selectedMarket.prices[selectedMarket.prices.length - 1]?.yb.toFixed(2) || '—'}
                  </div>
                </div>
                <div className="bg-[#0a0a0f] rounded-lg p-4">
                  <div className="text-gray-400 text-xs">Close Time</div>
                  <div className="text-lg font-bold text-amber-400">
                    {selectedMarket.closeTime ? formatDateTime(selectedMarket.closeTime) : '—'}
                  </div>
                </div>
              </div>
              
              <h4 className="text-sm font-semibold text-gray-400 mb-3">Price History</h4>
              <div className="max-h-[300px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-[#1a1a2e]">
                    <tr className="text-left text-gray-400 border-b border-gray-800">
                      <th className="py-2 px-3">Time</th>
                      <th className="py-2 px-3">Yes Bid</th>
                      <th className="py-2 px-3">Yes Ask</th>
                      <th className="py-2 px-3">Volume</th>
                      <th className="py-2 px-3">Open Interest</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedMarket.prices.slice().reverse().map((p, i) => (
                      <tr key={i} className="border-b border-gray-800/30">
                        <td className="py-2 px-3 text-gray-400">{formatDateTime(p.t)}</td>
                        <td className="py-2 px-3 font-mono text-green-400">${p.yb.toFixed(2)}</td>
                        <td className="py-2 px-3 font-mono text-red-400">${p.ya.toFixed(2)}</td>
                        <td className="py-2 px-3">{p.v.toLocaleString()}</td>
                        <td className="py-2 px-3">{p.oi.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Why This Matters */}
        <div className="mt-6 rounded-xl border border-purple-500/20 bg-purple-500/5 p-6">
          <h3 className="text-lg font-semibold text-purple-400 mb-3">🎯 Why This Matters</h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-300">
            <div>
              <p className="font-medium text-white mb-2">The Problem</p>
              <p>Historical market data only has settlement prices ($0 or $1). To backtest trading strategies, we need actual entry prices — what the market was trading at BEFORE it settled.</p>
            </div>
            <div>
              <p className="font-medium text-white mb-2">The Solution</p>
              <p>This system captures live bid/ask prices every 15 minutes. When markets settle, we can match outcomes to real entry prices and run valid backtests.</p>
            </div>
          </div>
          <div className="mt-4 p-4 bg-[#0a0a0f] rounded-lg">
            <p className="text-xs text-gray-400">
              <strong className="text-white">Timeline:</strong> After ~1 week, we'll have enough data covering market lifecycle from open → settle to run statistically significant backtests. 
              Current predictions ({status.totalMarkets} markets × {status.totalSnapshots} snapshots) are already usable for short-term analysis.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
