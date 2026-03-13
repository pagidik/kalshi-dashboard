'use client'

import { useEffect, useRef, useState } from 'react'
import { Prediction } from '../lib/predictions'

interface TooltipData {
  x: number
  y: number
  market: string
  pnl: number
  status: string
}

export default function ProfitChart({ predictions }: { predictions: Prediction[] }) {
  const [tooltipData, setTooltipData] = useState<TooltipData | null>(null)
  const [pathLength, setPathLength] = useState(0)
  const [mounted, setMounted] = useState(false)
  const pathRef = useRef<SVGPathElement>(null)

  const settled = predictions
    .filter(p => p.status === 'won' || p.status === 'lost')
    .sort((a, b) => new Date(a.firedAt).getTime() - new Date(b.firedAt).getTime())

  // Build cumulative P&L
  const points: { x: number; y: number; market: string; pnl: number; status: string; cumPnl: number }[] = []
  let cumPnl = 0
  settled.forEach((p, i) => {
    cumPnl += p.pnl ?? 0
    points.push({ x: i, y: cumPnl, market: p.market, pnl: p.pnl ?? 0, status: p.status, cumPnl })
  })

  const W = 800
  const H = 200
  const padX = 40
  const padY = 30
  const chartW = W - padX * 2
  const chartH = H - padY * 2

  const minY = Math.min(0, ...points.map(p => p.y))
  const maxY = Math.max(0, ...points.map(p => p.y))
  const rangeY = maxY - minY || 1

  const toSvgX = (i: number) => padX + (i / Math.max(points.length - 1, 1)) * chartW
  const toSvgY = (v: number) => padY + chartH - ((v - minY) / rangeY) * chartH

  const zeroY = toSvgY(0)

  const pathD = points.map((p, i) => {
    const x = toSvgX(i)
    const y = toSvgY(p.y)
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
  }).join(' ')

  const areaD = pathD +
    ` L ${toSvgX(points.length - 1)} ${zeroY} L ${toSvgX(0)} ${zeroY} Z`

  useEffect(() => {
    if (pathRef.current) {
      setPathLength(pathRef.current.getTotalLength())
    }
    const t = setTimeout(() => setMounted(true), 50)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="rounded-xl border border-border bg-surface p-6 md:p-8">
      <h2 className="text-xl font-semibold text-text">Profit Over Time</h2>
      <p className="mb-4 text-sm text-text-muted">Each dot is a completed bet</p>
      <div className="relative w-full overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 500 }}>
          {/* Zero line */}
          <line
            x1={padX} y1={zeroY} x2={W - padX} y2={zeroY}
            stroke="var(--text-muted)" strokeWidth={1} strokeDasharray="6 4" opacity={0.3}
          />
          {/* Y-axis labels */}
          <text x={padX - 8} y={toSvgY(maxY) + 4} textAnchor="end" fill="var(--text-muted)" fontSize={11}>+${maxY}</text>
          <text x={padX - 8} y={zeroY + 4} textAnchor="end" fill="var(--text-muted)" fontSize={11}>$0</text>
          {minY < 0 && (
            <text x={padX - 8} y={toSvgY(minY) + 4} textAnchor="end" fill="var(--text-muted)" fontSize={11}>-${Math.abs(minY)}</text>
          )}

          {/* Area fill */}
          <path d={areaD} fill="var(--accent)" opacity={0.08} />

          {/* Line */}
          <path
            ref={pathRef}
            d={pathD}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={pathLength || 2000}
            strokeDashoffset={mounted ? 0 : (pathLength || 2000)}
            style={{ transition: 'stroke-dashoffset 1.5s ease-out' }}
          />

          {/* Data points */}
          {points.map((p, i) => {
            const cx = toSvgX(i)
            const cy = toSvgY(p.y)
            const color = p.status === 'won' ? 'var(--green)' : 'var(--red)'
            return (
              <g key={i}>
                <circle cx={cx} cy={cy} r={12} fill="transparent"
                  onMouseEnter={() => setTooltipData({ x: cx, y: cy, market: p.market, pnl: p.pnl, status: p.status })}
                  onMouseLeave={() => setTooltipData(null)}
                  style={{ cursor: 'pointer' }}
                />
                <circle cx={cx} cy={cy} r={5} fill={color} stroke="var(--bg)" strokeWidth={2} style={{ pointerEvents: 'none' }} />
              </g>
            )
          })}

          {/* Tooltip */}
          {tooltipData && (
            <g>
              <rect
                x={tooltipData.x - 80} y={tooltipData.y - 50}
                width={160} height={36} rx={6}
                fill="var(--surface2)" stroke="var(--border)" strokeWidth={1}
              />
              <text x={tooltipData.x} y={tooltipData.y - 36} textAnchor="middle" fill="var(--text)" fontSize={11} fontWeight={600}>
                {tooltipData.market}
              </text>
              <text x={tooltipData.x} y={tooltipData.y - 22} textAnchor="middle" fill={tooltipData.pnl >= 0 ? 'var(--green)' : 'var(--red)'} fontSize={11}>
                {tooltipData.pnl >= 0 ? '+' : ''}{tooltipData.pnl}¢
              </text>
            </g>
          )}
        </svg>
      </div>
    </div>
  )
}
