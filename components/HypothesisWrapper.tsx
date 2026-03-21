'use client'

import HypothesisToast from './HypothesisToast'

export default function HypothesisWrapper() {
  const handleSubmit = async (
    name: string, 
    hypothesis: string, 
    impliedMin: number, 
    impliedMax: number, 
    minTrade: number
  ) => {
    const res = await fetch('/api/hypothesis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, hypothesis, impliedMin, impliedMax, minTrade })
    })
    
    if (!res.ok) {
      throw new Error('Failed to submit')
    }
    
    // Reload the page to show updated leaderboard
    window.location.reload()
  }
  
  return <HypothesisToast onSubmit={handleSubmit} />
}
