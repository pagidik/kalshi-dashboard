'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

function generateSessionId(): string {
  return 'sess_' + Math.random().toString(36).substring(2) + Date.now().toString(36)
}

function getSessionId(): string {
  if (typeof window === 'undefined') return ''
  
  let sessionId = sessionStorage.getItem('kalshi_session_id')
  if (!sessionId) {
    sessionId = generateSessionId()
    sessionStorage.setItem('kalshi_session_id', sessionId)
  }
  return sessionId
}

export default function VisitorTracker() {
  const pathname = usePathname()
  const [showNamePrompt, setShowNamePrompt] = useState(false)
  const [name, setName] = useState('')
  const [hasSubmittedName, setHasSubmittedName] = useState(false)
  
  useEffect(() => {
    // Check if user has already submitted name
    const submitted = localStorage.getItem('kalshi_name_submitted')
    if (submitted) {
      setHasSubmittedName(true)
    }
    
    // Track page visit - only once per session per page
    const trackVisit = async () => {
      try {
        const sessionId = getSessionId()
        
        // Only track once per page per session
        const trackKey = `kalshi_tracked_${pathname}`
        if (sessionStorage.getItem(trackKey)) return
        sessionStorage.setItem(trackKey, 'true')
        
        await fetch('/api/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            page: pathname,
            referrer: document.referrer || null,
            screenWidth: window.screen.width,
            screenHeight: window.screen.height,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            language: navigator.language,
            sessionId,
          })
        })
      } catch (e) {
        // Silent fail - don't block the user
      }
    }
    
    trackVisit()
    
    // Show name prompt after 30 seconds for first-time visitors
    if (!submitted) {
      const timer = setTimeout(() => {
        setShowNamePrompt(true)
      }, 30000)
      return () => clearTimeout(timer)
    }
  }, [pathname])
  
  const handleSubmitName = async () => {
    if (!name.trim()) return
    
    try {
      const sessionId = getSessionId()
      
      await fetch('/api/track', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, name: name.trim() })
      })
      
      localStorage.setItem('kalshi_name_submitted', 'true')
      setHasSubmittedName(true)
      setShowNamePrompt(false)
    } catch (e) {
      // Silent fail
    }
  }
  
  const handleDismiss = () => {
    localStorage.setItem('kalshi_name_submitted', 'true')
    setShowNamePrompt(false)
  }
  
  if (!showNamePrompt || hasSubmittedName) return null
  
  return (
    <div className="fixed bottom-4 right-4 z-50 animate-fade-in-up">
      <div className="bg-surface border border-border rounded-xl p-5 shadow-2xl max-w-sm">
        <div className="flex items-start justify-between mb-3">
          <p className="text-sm font-semibold text-text">👋 Hey there!</p>
          <button 
            onClick={handleDismiss}
            className="text-text-muted hover:text-text text-lg leading-none"
          >
            ×
          </button>
        </div>
        <p className="text-xs text-text-muted mb-4">
          Want to let us know who you are? Totally optional — we're just curious who's checking out our prediction tracker.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name (optional)"
            className="flex-1 bg-surface2 border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-accent"
            onKeyDown={(e) => e.key === 'Enter' && handleSubmitName()}
          />
          <button
            onClick={handleSubmitName}
            className="bg-accent/20 text-accent px-4 py-2 rounded-lg text-sm font-medium hover:bg-accent/30 transition-colors"
          >
            Send
          </button>
        </div>
        <p className="text-xs text-text-muted mt-2 opacity-60">
          No signup required. Just saying hi.
        </p>
      </div>
    </div>
  )
}
