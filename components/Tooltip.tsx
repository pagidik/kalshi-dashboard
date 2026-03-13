'use client'

import { useState, useRef, useEffect, ReactNode } from 'react'

export default function Tooltip({ children, text }: { children: ReactNode; text: string }) {
  const [show, setShow] = useState(false)
  const [pos, setPos] = useState<'top' | 'bottom'>('top')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (show && ref.current) {
      const rect = ref.current.getBoundingClientRect()
      if (rect.top < 80) setPos('bottom')
      else setPos('top')
    }
  }, [show])

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div
          ref={ref}
          className={`absolute z-50 w-64 rounded-lg border border-border bg-surface2 px-4 py-3 text-sm leading-relaxed text-text-muted shadow-xl ${
            pos === 'top' ? 'bottom-full left-1/2 mb-2 -translate-x-1/2' : 'top-full left-1/2 mt-2 -translate-x-1/2'
          }`}
        >
          {text}
        </div>
      )}
    </div>
  )
}
