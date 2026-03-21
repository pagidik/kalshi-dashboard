'use client'

import { useState, useEffect } from 'react'

interface LeaderboardEntry {
  id: string
  name: string
  hypothesis: string
  pnl: number
  win_rate: number
  trades: number
  rank: number
  is_best: boolean
  created_at: string
}

export default function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
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
    
    fetchLeaderboard()
  }, [])
  
  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-surface2 rounded w-48 mb-4" />
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-surface2 rounded" />
            ))}
          </div>
        </div>
      </div>
    )
  }
  
  const getMedal = (rank: number) => {
    if (rank === 1) return '🥇'
    if (rank === 2) return '🥈'
    if (rank === 3) return '🥉'
    return `#${rank}`
  }
  
  const getRowStyle = (rank: number, name: string) => {
    if (rank === 1) return 'bg-yellow-500/10 border-yellow-500/30'
    if (rank === 2) return 'bg-gray-400/10 border-gray-400/30'
    if (rank === 3) return 'bg-amber-600/10 border-amber-600/30'
    if (name === 'Donna') return 'bg-purple-500/5 border-purple-500/20'
    return 'border-border/30'
  }
  
  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          🏆 Hypothesis Leaderboard
        </h2>
        <p className="text-xs text-text-muted mt-1">
          Community-submitted betting rules, backtested on 763 real trades
        </p>
      </div>
      
      {entries.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-text-muted">No entries yet. Submit your hypothesis to be first!</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-text-muted text-xs uppercase tracking-wider border-b border-border/50">
                <th className="px-5 py-3 font-medium">Rank</th>
                <th className="px-5 py-3 font-medium">Trader</th>
                <th className="px-5 py-3 font-medium">Hypothesis</th>
                <th className="px-5 py-3 font-medium">P&L</th>
                <th className="px-5 py-3 font-medium">Win Rate</th>
                <th className="px-5 py-3 font-medium">Trades</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, i) => (
                <tr key={entry.id} className={`border-b ${getRowStyle(entry.rank, entry.name)} transition-colors`}>
                  <td className="px-5 py-4">
                    <span className="text-lg">{getMedal(entry.rank)}</span>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`font-medium ${entry.name === 'Donna' ? 'text-purple-400' : 'text-text'}`}>
                      {entry.name}
                      {entry.name === 'Donna' && <span className="ml-1 text-xs text-purple-400/60">🤖</span>}
                    </span>
                    {entry.is_best && (
                      <span className="ml-2 text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">Live</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-text-muted font-mono text-xs">
                    {entry.hypothesis}
                  </td>
                  <td className={`px-5 py-4 font-mono font-semibold ${entry.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {entry.pnl >= 0 ? '+' : ''}${entry.pnl.toLocaleString()}
                  </td>
                  <td className="px-5 py-4">
                    {(entry.win_rate * 100).toFixed(1)}%
                  </td>
                  <td className="px-5 py-4 text-text-muted">
                    {entry.trades}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
