import { NextRequest } from 'next/server'
import predictionsJson from '../../../public/data/predictions.json'

interface Prediction {
  id: string
  firedAt: string
  market: string
  ticker: string
  side: string
  price: number
  impliedPct: number
  contractsObserved: number
  dollarObserved: number
  status: string
  result: string
  pnl: number
  category: string
  anchorPrice?: number
  dipFromOpen?: number
}

interface ExperimentParams {
  minTradeUSD: number
  impliedRangeLo: number
  impliedRangeHi: number
  minDip: number
  maxDip: number
  requireCluster: boolean
  clusterWindowMs: number
  clusterMinCount: number
  skipCategories: string[]
  minContracts: number
}

const predictions = predictionsJson as unknown as Prediction[]

export async function POST(req: NextRequest) {
  const body = await req.json() as Partial<ExperimentParams>

  const params: ExperimentParams = {
    minTradeUSD:    body.minTradeUSD    ?? 200,
    impliedRangeLo: body.impliedRangeLo ?? 0.70,
    impliedRangeHi: body.impliedRangeHi ?? 1.0,
    minDip:         body.minDip         ?? 0,
    maxDip:         body.maxDip         ?? 1.0,
    requireCluster: body.requireCluster ?? false,
    clusterWindowMs: body.clusterWindowMs ?? 300_000,
    clusterMinCount: body.clusterMinCount ?? 3,
    skipCategories: body.skipCategories ?? [],
    minContracts:   body.minContracts   ?? 0,
  }

  const settled = predictions.filter(
    (p) => p.status === 'won' || p.status === 'lost'
  )

  // Primary filter
  let filtered = settled.filter((p) => {
    if (p.dollarObserved < params.minTradeUSD) return false
    if (p.price < params.impliedRangeLo || p.price > params.impliedRangeHi) return false
    if (params.skipCategories.includes(p.category)) return false
    if ((p.contractsObserved ?? 0) < params.minContracts) return false
    const dip = p.dipFromOpen ?? 0
    if (dip < params.minDip) return false
    if (dip > params.maxDip) return false
    return true
  })

  // Cluster filter
  if (params.requireCluster && filtered.length > 0) {
    const byTicker: Record<string, Prediction[]> = {}
    for (const p of filtered) {
      if (!byTicker[p.ticker]) byTicker[p.ticker] = []
      byTicker[p.ticker].push(p)
    }
    const clusterIds = new Set<string>()
    for (const sigs of Object.values(byTicker)) {
      for (let i = 0; i < sigs.length; i++) {
        const t0 = new Date(sigs[i].firedAt).getTime()
        const win = sigs.filter((s) => {
          const t = new Date(s.firedAt).getTime()
          return t >= t0 && t <= t0 + params.clusterWindowMs
        })
        if (win.length >= params.clusterMinCount) {
          win.forEach((s) => clusterIds.add(s.id))
        }
      }
    }
    filtered = filtered.filter((p) => clusterIds.has(p.id))
  }

  if (filtered.length < 3) {
    return Response.json({ status: 'INSUFFICIENT', nSignals: filtered.length, params })
  }

  const wins = filtered.filter((p) => p.status === 'won').length
  const winRate = wins / filtered.length
  const totalPnL = filtered.reduce((s, p) => s + (p.pnl ?? 0), 0)
  const perBetPnL = totalPnL / filtered.length
  const brier = filtered.reduce((s, p) => {
    const outcome = p.status === 'won' ? 1 : 0
    return s + Math.pow(p.price - outcome, 2)
  }, 0) / filtered.length

  // Sharpe (PnL std dev)
  const pnls = filtered.map((p) => p.pnl ?? 0)
  const mean = totalPnL / pnls.length
  const variance = pnls.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / pnls.length
  const sharpe = variance > 0 ? mean / Math.sqrt(variance) : 0

  // Bucket breakdown for UI
  const buckets = [
    { label: '65–75%', lo: 0.65, hi: 0.75 },
    { label: '75–80%', lo: 0.75, hi: 0.80 },
    { label: '80–90%', lo: 0.80, hi: 0.90 },
    { label: '90–100%', lo: 0.90, hi: 1.00 },
  ].map((b) => {
    const bSigs = filtered.filter((p) => p.price >= b.lo && p.price < b.hi)
    const bWins = bSigs.filter((p) => p.status === 'won').length
    return {
      label: b.label,
      n: bSigs.length,
      winRate: bSigs.length > 0 ? bWins / bSigs.length : 0,
      pnl: bSigs.reduce((s, p) => s + (p.pnl ?? 0), 0),
    }
  })

  return Response.json({
    status: 'OK',
    params,
    nSignals: filtered.length,
    nSettled: settled.length,
    winRate,
    totalPnL,
    perBetPnL,
    brierScore: brier,
    sharpe,
    buckets,
    signals: filtered.map((p) => ({
      market: p.market,
      price: p.price,
      dollarObserved: p.dollarObserved,
      dipFromOpen: p.dipFromOpen ?? 0,
      status: p.status,
      pnl: p.pnl,
      firedAt: p.firedAt,
      category: p.category,
    })),
  })
}
