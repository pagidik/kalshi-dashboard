'use client'

import { useState, useEffect } from 'react'

interface ExperimentResult {
  id: number
  hypothesis: string
  params: {
    impliedRange: [number, number]
    minTradeUSD: number
    sport?: string
  }
  result: 'IMPROVED' | 'REJECTED' | 'RUNNING' | 'PENDING'
  pnl: number
  winRate: number
  trades: number
  improvement?: string
}

interface ExperimentStatus {
  status: 'idle' | 'running' | 'complete'
  currentExperiment: number
  totalExperiments: number
  bestPnl: number
  bestConfig: string
  startedAt: string
  experiments: ExperimentResult[]
  log: string[]
}

export default function ExperimentsPage() {
  const [status, setStatus] = useState<ExperimentStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('/api/experiments/status')
        if (res.ok) {
          const data = await res.json()
          setStatus(data)
          setError(null)
        }
      } catch (e) {
        setError('Failed to fetch status')
      }
    }

    poll()
    const interval = setInterval(poll, 1000)
    return () => clearInterval(interval)
  }, [])

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white p-8">
        <h1 className="text-2xl font-bold mb-4">Experiment Lab</h1>
        <div className="bg-red-900/30 border border-red-500 rounded-lg p-4">
          {error}
        </div>
      </div>
    )
  }

  if (!status) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white p-8 flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  const progress = status.totalExperiments > 0 
    ? (status.currentExperiment / status.totalExperiments) * 100 
    : 0

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">🧪 Experiment Lab</h1>
          <div className={`px-4 py-2 rounded-full text-sm font-semibold ${
            status.status === 'running' ? 'bg-green-500/20 text-green-400 animate-pulse' :
            status.status === 'complete' ? 'bg-blue-500/20 text-blue-400' :
            'bg-gray-500/20 text-gray-400'
          }`}>
            {status.status === 'running' ? '● RUNNING' : 
             status.status === 'complete' ? '✓ COMPLETE' : '○ IDLE'}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="bg-[#1a1a2e] rounded-xl p-6 mb-6">
          <div className="flex justify-between mb-2">
            <span className="text-gray-400">Progress</span>
            <span className="text-white font-mono">
              {status.currentExperiment} / {status.totalExperiments}
            </span>
          </div>
          <div className="h-4 bg-[#0a0a0f] rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-[#1a1a2e] rounded-xl p-4">
            <div className="text-gray-400 text-sm mb-1">Best P&L</div>
            <div className={`text-2xl font-bold ${status.bestPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              ${status.bestPnl.toLocaleString()}
            </div>
          </div>
          <div className="bg-[#1a1a2e] rounded-xl p-4">
            <div className="text-gray-400 text-sm mb-1">Experiments</div>
            <div className="text-2xl font-bold text-white">
              {status.experiments.length}
            </div>
          </div>
          <div className="bg-[#1a1a2e] rounded-xl p-4">
            <div className="text-gray-400 text-sm mb-1">Improvements</div>
            <div className="text-2xl font-bold text-green-400">
              {status.experiments.filter(e => e.result === 'IMPROVED').length}
            </div>
          </div>
          <div className="bg-[#1a1a2e] rounded-xl p-4">
            <div className="text-gray-400 text-sm mb-1">Best Config</div>
            <div className="text-sm font-mono text-purple-400 truncate">
              {status.bestConfig || 'N/A'}
            </div>
          </div>
        </div>

        {/* Live Log */}
        <div className="bg-[#1a1a2e] rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">📡 Live Log</h2>
          <div className="bg-[#0a0a0f] rounded-lg p-4 h-48 overflow-y-auto font-mono text-sm">
            {status.log.slice(-20).map((line, i) => (
              <div key={i} className={`${
                line.includes('IMPROVED') ? 'text-green-400' :
                line.includes('REJECTED') ? 'text-gray-500' :
                line.includes('Testing') ? 'text-yellow-400' :
                line.includes('Best') ? 'text-purple-400' :
                'text-gray-300'
              }`}>
                {line}
              </div>
            ))}
            {status.status === 'running' && (
              <div className="text-blue-400 animate-pulse">▌</div>
            )}
          </div>
        </div>

        {/* Experiment Results Table */}
        <div className="bg-[#1a1a2e] rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">📊 Experiment Results</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-700">
                  <th className="pb-3 pr-4">#</th>
                  <th className="pb-3 pr-4">Hypothesis</th>
                  <th className="pb-3 pr-4">Range</th>
                  <th className="pb-3 pr-4">Min $</th>
                  <th className="pb-3 pr-4">Trades</th>
                  <th className="pb-3 pr-4">Win %</th>
                  <th className="pb-3 pr-4">P&L</th>
                  <th className="pb-3">Result</th>
                </tr>
              </thead>
              <tbody>
                {status.experiments.slice().reverse().slice(0, 20).map((exp) => (
                  <tr key={exp.id} className="border-b border-gray-800">
                    <td className="py-3 pr-4 text-gray-500">{exp.id}</td>
                    <td className="py-3 pr-4 text-gray-300 max-w-[200px] truncate">{exp.hypothesis}</td>
                    <td className="py-3 pr-4 font-mono text-purple-400">
                      {exp.params.impliedRange[0]*100}-{exp.params.impliedRange[1]*100}%
                    </td>
                    <td className="py-3 pr-4 font-mono">${exp.params.minTradeUSD}</td>
                    <td className="py-3 pr-4">{exp.trades}</td>
                    <td className="py-3 pr-4">{(exp.winRate * 100).toFixed(1)}%</td>
                    <td className={`py-3 pr-4 font-mono ${exp.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      ${exp.pnl.toFixed(0)}
                    </td>
                    <td className="py-3">
                      {exp.result === 'IMPROVED' && <span className="text-green-400">✓ IMPROVED</span>}
                      {exp.result === 'REJECTED' && <span className="text-gray-500">✗ REJECTED</span>}
                      {exp.result === 'RUNNING' && <span className="text-yellow-400 animate-pulse">● RUNNING</span>}
                      {exp.result === 'PENDING' && <span className="text-gray-600">○ PENDING</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
