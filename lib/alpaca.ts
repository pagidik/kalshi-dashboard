// Alpaca Paper Trading API Client

const ALPACA_BASE = 'https://paper-api.alpaca.markets'
const ALPACA_DATA = 'https://data.alpaca.markets'
const ALPACA_KEY = process.env.ALPACA_API_KEY || 'PKPOTXRX3LZW7HHLL2ULTQ5GKW'
const ALPACA_SECRET = process.env.ALPACA_SECRET_KEY || '49hW1QC5WxE1TsKei4DmN3bcsJ68Esxa1toWCXTBfmvb'

const headers = {
  'APCA-API-KEY-ID': ALPACA_KEY,
  'APCA-API-SECRET-KEY': ALPACA_SECRET,
  'Content-Type': 'application/json',
}

export interface AlpacaAccount {
  id: string
  equity: string
  buying_power: string
  cash: string
  portfolio_value: string
  status: string
  pattern_day_trader: boolean
  trading_blocked: boolean
  daytrade_count: number
}

export interface AlpacaPosition {
  asset_id: string
  symbol: string
  qty: string
  avg_entry_price: string
  market_value: string
  cost_basis: string
  unrealized_pl: string
  unrealized_plpc: string
  current_price: string
  side: 'long' | 'short'
}

export interface AlpacaOrder {
  id: string
  client_order_id: string
  symbol: string
  qty: string
  filled_qty: string
  side: 'buy' | 'sell'
  type: string
  status: string
  submitted_at: string
  filled_at: string | null
  filled_avg_price: string | null
  order_class: string
  legs?: AlpacaOrder[]
}

export interface AlpacaActivity {
  id: string
  activity_type: string
  symbol?: string
  side?: string
  qty?: string
  price?: string
  transaction_time: string
  net_amount?: string
}

export async function getAccount(): Promise<AlpacaAccount> {
  const resp = await fetch(`${ALPACA_BASE}/v2/account`, { headers })
  if (!resp.ok) throw new Error(`Alpaca API error: ${resp.status}`)
  return resp.json()
}

export async function getPositions(): Promise<AlpacaPosition[]> {
  const resp = await fetch(`${ALPACA_BASE}/v2/positions`, { headers })
  if (!resp.ok) throw new Error(`Alpaca API error: ${resp.status}`)
  return resp.json()
}

export async function getOrders(status = 'all', limit = 100): Promise<AlpacaOrder[]> {
  const resp = await fetch(`${ALPACA_BASE}/v2/orders?status=${status}&limit=${limit}`, { headers })
  if (!resp.ok) throw new Error(`Alpaca API error: ${resp.status}`)
  return resp.json()
}

export async function getActivities(activityType = 'FILL', limit = 100): Promise<AlpacaActivity[]> {
  const resp = await fetch(`${ALPACA_BASE}/v2/account/activities/${activityType}?limit=${limit}`, { headers })
  if (!resp.ok) throw new Error(`Alpaca API error: ${resp.status}`)
  return resp.json()
}

export async function getPortfolioHistory(period = '1M', timeframe = '1D'): Promise<{
  timestamp: number[]
  equity: number[]
  profit_loss: number[]
  profit_loss_pct: number[]
}> {
  const resp = await fetch(`${ALPACA_BASE}/v2/account/portfolio/history?period=${period}&timeframe=${timeframe}`, { headers })
  if (!resp.ok) throw new Error(`Alpaca API error: ${resp.status}`)
  return resp.json()
}

export async function getQuote(symbol: string): Promise<{
  symbol: string
  bid_price: number
  ask_price: number
  last_price: number
}> {
  const resp = await fetch(`${ALPACA_DATA}/v2/stocks/${symbol}/quotes/latest`, { headers })
  if (!resp.ok) throw new Error(`Alpaca API error: ${resp.status}`)
  const data = await resp.json()
  return {
    symbol,
    bid_price: data.quote?.bp || 0,
    ask_price: data.quote?.ap || 0,
    last_price: (data.quote?.bp + data.quote?.ap) / 2 || 0,
  }
}
