'use client'

import { useState, useEffect } from 'react'

interface LeaderboardEntry {
  id: string
  name: string
  hypothesis: string
  pnl: number
  win_rate: number
  trades: number
  is_best: boolean
  created_at: string
}

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  
  // Form state
  const [name, setName] = useState('')
  const [impliedMin, setImpliedMin] = useState(60)
  const [impliedMax, setImpliedMax] = useState(100)
  const [minTrade, setMinTrade] = useState(500)
  const [result, setResult] = useState<{pnl: number; winRate: number; trades: number; isBest: boolean} | null>(null)
  
  const fetchLeaderboard = async () => {
    try {
      const res = await fetch('/api/leaderboard')
      if (res.ok) {
        const data = await res.json()
        setEntries(data)
      }
    } catch (e) {
      console.error('Failed to fetch leaderboard:', e)
    } finally {
      setLoading(false)
    }
  }
  
  useEffect(() => {
    fetchLeaderboard()
  }, [])
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    
    setSubmitting(true)
    setResult(null)
    
    const hypothesis = `${impliedMin}-${impliedMax}% implied, $${minTrade} min`
    
    try {
      const res = await fetch('/api/hypothesis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: name.trim(), 
          hypothesis, 
          impliedMin: impliedMin / 100, 
          impliedMax: impliedMax / 100, 
          minTrade 
        })
      })
      
      if (res.ok) {
        const data = await res.json()
        setResult({
          pnl: data.pnl,
          winRate: data.winRate,
          trades: data.trades,
          isBest: data.isBest
        })
        setSubmitted(true)
        fetchLeaderboard() // Refresh leaderboard
      }
    } catch (e) {
      console.error('Submit failed:', e)
    } finally {
      setSubmitting(false)
    }
  }
  
  const getMedal = (rank: number) => {
    if (rank === 1) return '🥇'
    if (rank === 2) return '🥈'
    if (rank === 3) return '🥉'
    return `#${rank}`
  }
  
  const getRowStyle = (rank: number, entryName: string) => {
    if (rank === 1) return 'bg-yellow-500/10 border-l-4 border-l-yellow-500'
    if (rank === 2) return 'bg-gray-400/5 border-l-4 border-l-gray-400'
    if (rank === 3) return 'bg-amber-600/5 border-l-4 border-l-amber-600'
    if (entryName === 'Donna') return 'bg-purple-500/5 border-l-4 border-l-purple-500'
    return ''
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-6xl mx-auto px-4 py-8 md:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold">🏆 Hypothesis Leaderboard</h1>
          <p className="text-text-muted mt-2">Submit your betting rule and see how it performs against 763 real trades</p>
        </div>
        
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Submit Form */}
          <div className="lg:col-span-1">
            <div className="rounded-xl border border-accent/30 bg-surface p-6 sticky top-20">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                🧪 Submit Your Hypothesis
              </h2>
              
              {!submitted ? (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="text-xs text-text-muted block mb-2">Your name (for the leaderboard)</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., John"
                      className="w-full bg-surface2 border border-border rounded-lg px-4 py-3 text-text placeholder:text-text-muted focus:outline-none focus:border-accent"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="text-xs text-text-muted block mb-2">
                      Only bet when market shows this % chance:
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        value={impliedMin}
                        onChange={(e) => setImpliedMin(Number(e.target.value))}
                        min={0}
                        max={100}
                        className="w-20 bg-surface2 border border-border rounded-lg px-3 py-2 text-text focus:outline-none focus:border-accent text-center"
                      />
                      <span className="text-text-muted">% to</span>
                      <input
                        type="number"
                        value={impliedMax}
                        onChange={(e) => setImpliedMax(Number(e.target.value))}
                        min={0}
                        max={100}
                        className="w-20 bg-surface2 border border-border rounded-lg px-3 py-2 text-text focus:outline-none focus:border-accent text-center"
                      />
                      <span className="text-text-muted">%</span>
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-xs text-text-muted block mb-2">
                      Min trade size to trigger:
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-text-muted">$</span>
                      <input
                        type="number"
                        value={minTrade}
                        onChange={(e) => setMinTrade(Number(e.target.value))}
                        min={0}
                        step={50}
                        className="w-32 bg-surface2 border border-border rounded-lg px-3 py-2 text-text focus:outline-none focus:border-accent text-center"
                      />
                    </div>
                  </div>
                  
                  <div className="bg-surface2 rounded-lg p-4">
                    <p className="text-xs text-text-muted">
                      <strong className="text-text">Your rule:</strong><br />
                      "Bet when market shows {impliedMin}%-{impliedMax}% chance and trade ≥ ${minTrade}"
                    </p>
                  </div>
                  
                  <button
                    type="submit"
                    disabled={submitting || !name.trim()}
                    className="w-full bg-accent text-bg px-4 py-3 rounded-lg font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-bg border-t-transparent rounded-full animate-spin" />
                        Running Backtest...
                      </>
                    ) : (
                      'Run Backtest →'
                    )}
                  </button>
                </form>
              ) : (
                <div className="text-center py-4">
                  <div className={`w-16 h-16 rounded-full ${result?.isBest ? 'bg-yellow-500/20' : 'bg-green-500/20'} flex items-center justify-center mx-auto mb-4`}>
                    <span className="text-3xl">{result?.isBest ? '🏆' : '✓'}</span>
                  </div>
                  <p className="text-lg font-bold text-text mb-2">
                    {result?.isBest ? 'New #1! 🎉' : 'Backtest Complete!'}
                  </p>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-surface2 rounded-lg p-3">
                      <p className="text-xs text-text-muted">P&L</p>
                      <p className={`text-lg font-bold ${(result?.pnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        ${result?.pnl?.toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-surface2 rounded-lg p-3">
                      <p className="text-xs text-text-muted">Win Rate</p>
                      <p className="text-lg font-bold text-text">{((result?.winRate || 0) * 100).toFixed(1)}%</p>
                    </div>
                    <div className="bg-surface2 rounded-lg p-3">
                      <p className="text-xs text-text-muted">Trades</p>
                      <p className="text-lg font-bold text-text">{result?.trades}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSubmitted(false)
                      setResult(null)
                      setName('')
                    }}
                    className="text-accent hover:underline text-sm"
                  >
                    Try another hypothesis →
                  </button>
                </div>
              )}
            </div>
          </div>
          
          {/* Leaderboard */}
          <div className="lg:col-span-2">
            <div className="rounded-xl border border-border bg-surface overflow-hidden">
              <div className="px-6 py-4 border-b border-border">
                <h2 className="text-lg font-semibold">Rankings</h2>
                <p className="text-xs text-text-muted mt-1">
                  All hypotheses backtested on 763 real trades with verified entry prices
                </p>
              </div>
              
              {loading ? (
                <div className="p-8 text-center">
                  <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-text-muted">Loading leaderboard...</p>
                </div>
              ) : entries.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-4xl mb-3">🏆</p>
                  <p className="text-text-muted">No entries yet. Be the first to submit!</p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {entries.map((entry, i) => {
                    const rank = i + 1
                    return (
                      <div key={entry.id} className={`px-6 py-4 ${getRowStyle(rank, entry.name)} transition-colors hover:bg-accent/[0.02]`}>
                        <div className="flex items-center gap-4">
                          {/* Rank */}
                          <div className="w-12 text-center">
                            <span className="text-2xl">{getMedal(rank)}</span>
                          </div>
                          
                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`font-semibold ${entry.name === 'Donna' ? 'text-purple-400' : 'text-text'}`}>
                                {entry.name}
                              </span>
                              {entry.name === 'Donna' && <span className="text-purple-400/60">🤖</span>}
                              {entry.is_best && (
                                <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">Live Config</span>
                              )}
                            </div>
                            <p className="text-sm text-text-muted font-mono">{entry.hypothesis}</p>
                          </div>
                          
                          {/* Stats */}
                          <div className="flex items-center gap-6 text-right">
                            <div>
                              <p className="text-xs text-text-muted">P&L</p>
                              <p className={`font-bold font-mono ${entry.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {entry.pnl >= 0 ? '+' : ''}${entry.pnl.toLocaleString()}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-text-muted">Win %</p>
                              <p className="font-semibold">{(entry.win_rate * 100).toFixed(1)}%</p>
                            </div>
                            <div>
                              <p className="text-xs text-text-muted">Trades</p>
                              <p className="text-text-muted">{entry.trades}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            
            {/* Explanation */}
            <div className="mt-6 rounded-xl border border-accent/20 bg-accent/5 p-6">
              <h3 className="font-semibold text-accent mb-3">How it works</h3>
              <div className="space-y-3 text-sm text-text-muted">
                <p>
                  <strong className="text-text">1. Submit your rule:</strong> Choose what % probability range and minimum trade size should trigger a bet.
                </p>
                <p>
                  <strong className="text-text">2. Backtest runs:</strong> We test your rule against 763 real trades where we know the actual entry price and outcome.
                </p>
                <p>
                  <strong className="text-text">3. See your rank:</strong> Your hypothesis is ranked by total P&L. If you beat the current best, your config becomes the live one!
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
