'use client'

import { ReactNode } from 'react'
import Tooltip from './Tooltip'

interface StatCardProps {
  title: string
  value: string
  label: string
  subtext: string
  tooltip: string
  color?: string
  children?: ReactNode
}

export default function StatCard({ title, value, label, subtext, tooltip, color, children }: StatCardProps) {
  return (
    <Tooltip text={tooltip}>
      <div className="flex h-full flex-col justify-between rounded-xl border border-border bg-surface p-6 md:p-8 transition-all hover:border-accent/30 hover:shadow-[0_0_30px_rgba(0,255,212,0.05)]">
        <div className="mb-1 text-xs font-medium uppercase tracking-widest text-text-muted">{label}</div>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="text-3xl font-bold md:text-4xl" style={color ? { color } : undefined}>
              {value}
            </div>
            <div className="mt-2 text-sm text-text-muted leading-relaxed">{subtext}</div>
          </div>
          {children && <div className="shrink-0">{children}</div>}
        </div>
      </div>
    </Tooltip>
  )
}
