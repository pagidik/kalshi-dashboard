import { NextResponse } from 'next/server'
import { readFileSync, existsSync, statSync } from 'fs'

export const dynamic = 'force-dynamic'

const DATA_FILE = 'C:\\Users\\kisho\\clawd\\scripts\\kalshi-price-snapshots.json'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export async function GET() {
  if (!existsSync(DATA_FILE)) {
    return NextResponse.json({
      status: 'error',
      totalMarkets: 0,
      totalSnapshots: 0,
      oldestSnapshot: null,
      newestSnapshot: null,
      seriesBreakdown: {},
      markets: [],
      dataSize: '0 B',
      nextCaptureIn: '~15 min'
    })
  }

  try {
    const stats = statSync(DATA_FILE)
    const data = JSON.parse(readFileSync(DATA_FILE, 'utf8'))
    
    const marketHistory = data.marketHistory || {}
    const markets = Object.values(marketHistory) as Array<{
      ticker: string
      eventTicker: string
      seriesTicker: string
      title: string
      closeTime: string
      prices: Array<{ t: string; yb: number; ya: number; v: number; oi: number }>
    }>
    
    // Calculate stats
    let totalSnapshots = 0
    let oldestSnapshot: string | null = null
    let newestSnapshot: string | null = null
    const seriesBreakdown: Record<string, number> = {}
    
    for (const market of markets) {
      totalSnapshots += market.prices.length
      
      // Track series breakdown
      const series = market.seriesTicker
      seriesBreakdown[series] = (seriesBreakdown[series] || 0) + 1
      
      // Track oldest/newest
      for (const price of market.prices) {
        if (!oldestSnapshot || price.t < oldestSnapshot) oldestSnapshot = price.t
        if (!newestSnapshot || price.t > newestSnapshot) newestSnapshot = price.t
      }
    }
    
    // Calculate next capture time (runs every 15 min)
    const now = Date.now()
    const lastRun = newestSnapshot ? new Date(newestSnapshot).getTime() : now
    const nextRun = lastRun + 15 * 60 * 1000
    const msUntilNext = Math.max(0, nextRun - now)
    const minsUntilNext = Math.ceil(msUntilNext / 60000)
    const nextCaptureIn = minsUntilNext <= 0 ? 'Soon' : `${minsUntilNext} min`
    
    // Sort markets by number of snapshots (most data first)
    const sortedMarkets = markets.sort((a, b) => b.prices.length - a.prices.length)
    
    return NextResponse.json({
      status: 'active',
      totalMarkets: markets.length,
      totalSnapshots,
      oldestSnapshot,
      newestSnapshot,
      seriesBreakdown,
      markets: sortedMarkets,
      dataSize: formatBytes(stats.size),
      nextCaptureIn
    })
  } catch (e) {
    return NextResponse.json({
      status: 'error',
      totalMarkets: 0,
      totalSnapshots: 0,
      oldestSnapshot: null,
      newestSnapshot: null,
      seriesBreakdown: {},
      markets: [],
      dataSize: '0 B',
      nextCaptureIn: '~15 min'
    })
  }
}
