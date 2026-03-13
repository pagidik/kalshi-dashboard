export type Status = 'won' | 'lost' | 'pending' | 'expired'
export type Category = 'sports' | 'crypto' | 'other'
export type Side = 'YES' | 'NO'

export interface Prediction {
  id: string
  firedAt: string
  market: string
  side: Side
  price: number
  impliedPct: number
  dollarObserved: number
  pnl: number | null
  status: Status
  category: Category
  note: string
}

export const predictions: Prediction[] = [
  { id:'1', firedAt:'2026-03-12T21:52:00Z', market:'Miami vs Louisville', side:'YES', price:0.74, impliedPct:74, dollarObserved:491, pnl:26, status:'won', category:'sports', note:'Miami won 78-73' },
  { id:'2', firedAt:'2026-03-12T22:00:00Z', market:'Miami vs Louisville', side:'NO', price:0.96, impliedPct:96, dollarObserved:914, pnl:4, status:'won', category:'sports', note:'Miami won, Louisville did not' },
  { id:'3', firedAt:'2026-03-12T21:52:00Z', market:'Auburn vs Tennessee', side:'YES', price:0.20, impliedPct:20, dollarObserved:350, pnl:-20, status:'lost', category:'sports', note:'Tennessee won 72-62' },
  { id:'4', firedAt:'2026-03-12T22:00:00Z', market:'Auburn vs Tennessee', side:'NO', price:0.48, impliedPct:48, dollarObserved:569, pnl:52, status:'won', category:'sports', note:'Tennessee won, Auburn did not' },
  { id:'5', firedAt:'2026-03-12T23:38:00Z', market:'Nevada vs Grand Canyon', side:'YES', price:0.50, impliedPct:50, dollarObserved:452, pnl:50, status:'won', category:'sports', note:'Nevada won 84-80' },
  { id:'6', firedAt:'2026-03-12T23:38:00Z', market:'BYU vs Houston', side:'YES', price:0.90, impliedPct:90, dollarObserved:316, pnl:10, status:'won', category:'sports', note:'Houston won 73-66' },
  { id:'7', firedAt:'2026-03-12T22:05:00Z', market:'Louisiana Tech Winner', side:'YES', price:0.99, impliedPct:99, dollarObserved:347, pnl:1, status:'won', category:'sports', note:'Louisiana Tech won' },
  { id:'8', firedAt:'2026-03-12T23:38:00Z', market:'Milwaukee vs Miami Heat', side:'YES', price:0.68, impliedPct:68, dollarObserved:2129, pnl:null, status:'pending', category:'sports', note:'NBA game, result pending' },
  { id:'9', firedAt:'2026-03-13T00:34:00Z', market:'Georgetown vs Villanova', side:'YES', price:0.73, impliedPct:73, dollarObserved:365, pnl:null, status:'pending', category:'sports', note:'Big East tournament' },
  { id:'10', firedAt:'2026-03-13T00:34:00Z', market:'Duke Spread (-9.5)', side:'NO', price:0.95, impliedPct:95, dollarObserved:659, pnl:null, status:'pending', category:'other', note:'ACC tournament spread' },
  { id:'11', firedAt:'2026-03-13T00:34:00Z', market:'Philadelphia vs Detroit', side:'NO', price:0.97, impliedPct:97, dollarObserved:353, pnl:null, status:'pending', category:'sports', note:'NBA game' },
  { id:'12', firedAt:'2026-03-13T00:34:00Z', market:'Ohio vs Kent State', side:'YES', price:0.95, impliedPct:95, dollarObserved:391, pnl:null, status:'pending', category:'sports', note:'MAC tournament' },
  { id:'13', firedAt:'2026-03-12T21:55:00Z', market:'BTC 15-min Price', side:'YES', price:0.99, impliedPct:99, dollarObserved:990, pnl:0, status:'expired', category:'crypto', note:'Short-term crypto market, expired' },
  { id:'14', firedAt:'2026-03-12T22:05:00Z', market:'Bitcoin Daily Close', side:'YES', price:0.95, impliedPct:95, dollarObserved:1138, pnl:null, status:'pending', category:'crypto', note:'Daily BTC price market' },
]

export const config = {
  winRate: 0.857,
  brierScore: 0.107,
  totalPnL: 123,
  minTradeUSD: 400,
  impliedRange: [0.40, 0.65] as [number, number],
  kellyBet: 250,
  dataPoints: 7,
  notes: 'Sports 85% win rate. Sweet spot: 40-65% implied probability.'
}
