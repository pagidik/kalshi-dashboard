'use client'

import { useState, useEffect } from 'react'

interface HypothesisToastProps {
  onSubmit: (name: string, hypothesis: string, impliedMin: number, impliedMax: number, minTrade: number) => void
}

export default function HypothesisToast({ onSubmit }: HypothesisToastProps) {
  const [show, setShow] = useState(false)
  const [step, setStep] = useState<'prompt' | 'form' | 'submitting' | 'done'>('prompt')
  const [name, setName] = useState('')
  const [impliedMin, setImpliedMin] = useState(60)
  const [impliedMax, setImpliedMax] = useState(100)
  const [minTrade, setMinTrade] = useState(500)
  
  useEffect(() => {
    // Show after 10 seconds if not dismissed before
    const dismissed = sessionStorage.getItem('hypothesis_toast_dismissed')
    if (dismissed) return
    
    const timer = setTimeout(() => setShow(true), 10000)
    return () => clearTimeout(timer)
  }, [])
  
  const handleDismiss = () => {
    sessionStorage.setItem('hypothesis_toast_dismissed', 'true')
    setShow(false)
  }
  
  const handleSubmit = async () => {
    if (!name.trim()) return
    
    setStep('submitting')
    
    const hypothesis = `${impliedMin}-${impliedMax}% implied, $${minTrade} min`
    
    try {
      await onSubmit(name, hypothesis, impliedMin / 100, impliedMax / 100, minTrade)
      setStep('done')
      setTimeout(() => {
        sessionStorage.setItem('hypothesis_toast_dismissed', 'true')
        setShow(false)
      }, 3000)
    } catch (e) {
      setStep('form')
    }
  }
  
  if (!show) return null
  
  return (
    <div className="fixed bottom-4 left-4 z-50 animate-fade-in-up max-w-md">
      <div className="bg-surface border border-accent/30 rounded-xl p-5 shadow-2xl">
        {step === 'prompt' && (
          <>
            <div className="flex items-start justify-between mb-3">
              <p className="text-sm font-semibold text-accent">🧪 Got a trading hypothesis?</p>
              <button onClick={handleDismiss} className="text-text-muted hover:text-text text-lg leading-none">×</button>
            </div>
            <p className="text-xs text-text-muted mb-4">
              Think you know a better betting rule? Submit your hypothesis and we'll backtest it against 763 real trades. 
              If yours beats the current best, you'll top the leaderboard!
            </p>
            <button
              onClick={() => setStep('form')}
              className="w-full bg-accent/20 text-accent px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-accent/30 transition-colors"
            >
              Submit My Hypothesis →
            </button>
          </>
        )}
        
        {step === 'form' && (
          <>
            <div className="flex items-start justify-between mb-4">
              <p className="text-sm font-semibold text-text">Your Betting Rule</p>
              <button onClick={handleDismiss} className="text-text-muted hover:text-text text-lg leading-none">×</button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs text-text-muted block mb-1">Your name (for the leaderboard)</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., John"
                  className="w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-accent"
                />
              </div>
              
              <div>
                <label className="text-xs text-text-muted block mb-2">
                  Only bet when market thinks outcome has this % chance:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={impliedMin}
                    onChange={(e) => setImpliedMin(Number(e.target.value))}
                    min={0}
                    max={100}
                    className="w-20 bg-surface2 border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent text-center"
                  />
                  <span className="text-text-muted">% to</span>
                  <input
                    type="number"
                    value={impliedMax}
                    onChange={(e) => setImpliedMax(Number(e.target.value))}
                    min={0}
                    max={100}
                    className="w-20 bg-surface2 border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent text-center"
                  />
                  <span className="text-text-muted">%</span>
                </div>
              </div>
              
              <div>
                <label className="text-xs text-text-muted block mb-2">
                  Only bet when someone puts at least $__ on it:
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-text-muted">$</span>
                  <input
                    type="number"
                    value={minTrade}
                    onChange={(e) => setMinTrade(Number(e.target.value))}
                    min={0}
                    step={50}
                    className="w-28 bg-surface2 border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent text-center"
                  />
                </div>
              </div>
              
              <div className="bg-surface2 rounded-lg p-3">
                <p className="text-xs text-text-muted">
                  <strong className="text-text">Your rule:</strong> "Bet when market shows {impliedMin}%-{impliedMax}% chance and trade size ≥ ${minTrade}"
                </p>
              </div>
              
              <button
                onClick={handleSubmit}
                disabled={!name.trim()}
                className="w-full bg-accent text-bg px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Run Backtest →
              </button>
            </div>
          </>
        )}
        
        {step === 'submitting' && (
          <div className="text-center py-4">
            <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-sm text-text">Running backtest on 763 trades...</p>
            <p className="text-xs text-text-muted mt-1">This takes a few seconds</p>
          </div>
        )}
        
        {step === 'done' && (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full bg-green-500/20 text-green-400 text-2xl flex items-center justify-center mx-auto mb-3">✓</div>
            <p className="text-sm font-semibold text-text">Backtest complete!</p>
            <p className="text-xs text-text-muted mt-1">Check the leaderboard to see how you ranked</p>
          </div>
        )}
      </div>
    </div>
  )
}
