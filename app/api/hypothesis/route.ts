import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import predictionsJson from '../../../public/data/predictions.json'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  'https://rvxteuojvgkdjgbupcts.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2eHRldW9qdmdrZGpnYnVwY3RzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzU1MTQxMywiZXhwIjoyMDg5MTI3NDEzfQ.rgCOE_w5SUCQQ503dT646wNs5f3dMd6fTu3Fqmx6mKA'
)

interface Prediction {
  status: string
  impliedPct: number
  dollarObserved: number
  price: number
}

function runBacktest(impliedMin: number, impliedMax: number, minTrade: number) {
  const predictions = predictionsJson as Prediction[]
  const settled = predictions.filter(p => p.status === 'won' || p.status === 'lost')
  const betSize = 100
  
  const filtered = settled.filter(p => {
    const implied = p.impliedPct / 100
    return implied >= impliedMin && 
           implied <= impliedMax &&
           p.dollarObserved >= minTrade
  })
  
  let wins = 0
  let losses = 0
  let pnl = 0
  
  for (const p of filtered) {
    if (p.status === 'won') {
      const profit = betSize * (1 - p.price)
      pnl += profit
      wins++
    } else {
      const loss = betSize * p.price
      pnl -= loss
      losses++
    }
  }
  
  const total = wins + losses
  const winRate = total > 0 ? wins / total : 0
  
  return { 
    wins, 
    losses, 
    trades: total, 
    winRate: Math.round(winRate * 10000) / 10000, 
    pnl: Math.round(pnl * 100) / 100 
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { name, hypothesis, impliedMin, impliedMax, minTrade } = body
    
    if (!name || impliedMin === undefined || impliedMax === undefined || minTrade === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    
    // Run the backtest
    const result = runBacktest(impliedMin, impliedMax, minTrade)
    
    // Check if this is the best
    const { data: currentBest } = await supabase
      .from('experiment_leaderboard')
      .select('pnl')
      .order('pnl', { ascending: false })
      .limit(1)
    
    const isBest = !currentBest || currentBest.length === 0 || result.pnl > currentBest[0].pnl
    
    // If this is best, unset previous best
    if (isBest) {
      await supabase
        .from('experiment_leaderboard')
        .update({ is_best: false })
        .eq('is_best', true)
    }
    
    // Insert the new entry
    const { data, error } = await supabase
      .from('experiment_leaderboard')
      .insert([{
        name,
        hypothesis,
        implied_min: impliedMin,
        implied_max: impliedMax,
        min_trade: minTrade,
        pnl: result.pnl,
        win_rate: result.winRate,
        trades: result.trades,
        is_best: isBest,
        status: 'complete'
      }])
      .select()
    
    if (error) {
      console.error('Insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({
      ...result,
      isBest,
      entry: data?.[0]
    })
  } catch (e) {
    console.error('Hypothesis error:', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
