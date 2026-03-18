'use client'

import { useEffect, useRef } from 'react'

interface HypothesisData {
  wave: number
  date: string
  hypothesis: string
  description: string
  pnl: number
  winRate: number
  brier: number
  samples: number
  improved: boolean
}

interface Props {
  data: HypothesisData[]
}

export default function HypothesisChart({ data }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // High DPI support
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    const width = rect.width
    const height = rect.height
    const padding = { top: 40, right: 30, bottom: 80, left: 60 }
    const chartWidth = width - padding.left - padding.right
    const chartHeight = height - padding.top - padding.bottom

    // Clear
    ctx.fillStyle = '#0a0f1a'
    ctx.fillRect(0, 0, width, height)

    // Calculate scales
    const maxPnl = Math.max(...data.map(d => d.pnl)) * 1.1
    const minPnl = Math.min(0, ...data.map(d => d.pnl)) * 1.1

    const xScale = (i: number) => padding.left + (i / (data.length - 1)) * chartWidth
    const yScale = (pnl: number) => padding.top + chartHeight - ((pnl - minPnl) / (maxPnl - minPnl)) * chartHeight

    // Grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)'
    ctx.lineWidth = 1
    const gridLines = 5
    for (let i = 0; i <= gridLines; i++) {
      const y = padding.top + (i / gridLines) * chartHeight
      ctx.beginPath()
      ctx.moveTo(padding.left, y)
      ctx.lineTo(width - padding.right, y)
      ctx.stroke()

      // Y-axis labels
      const value = maxPnl - (i / gridLines) * (maxPnl - minPnl)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
      ctx.font = '11px system-ui'
      ctx.textAlign = 'right'
      ctx.fillText(`$${value.toFixed(0)}`, padding.left - 8, y + 4)
    }

    // Zero line
    if (minPnl < 0) {
      const zeroY = yScale(0)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(padding.left, zeroY)
      ctx.lineTo(width - padding.right, zeroY)
      ctx.stroke()
      ctx.setLineDash([])
    }

    // Draw area under curve
    ctx.beginPath()
    ctx.moveTo(xScale(0), yScale(0))
    data.forEach((d, i) => {
      ctx.lineTo(xScale(i), yScale(d.pnl))
    })
    ctx.lineTo(xScale(data.length - 1), yScale(0))
    ctx.closePath()
    const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartHeight)
    gradient.addColorStop(0, 'rgba(0, 255, 212, 0.3)')
    gradient.addColorStop(1, 'rgba(0, 255, 212, 0)')
    ctx.fillStyle = gradient
    ctx.fill()

    // Draw line
    ctx.beginPath()
    ctx.strokeStyle = '#00ffd4'
    ctx.lineWidth = 3
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    data.forEach((d, i) => {
      if (i === 0) ctx.moveTo(xScale(i), yScale(d.pnl))
      else ctx.lineTo(xScale(i), yScale(d.pnl))
    })
    ctx.stroke()

    // Draw points and labels
    data.forEach((d, i) => {
      const x = xScale(i)
      const y = yScale(d.pnl)

      // Point
      ctx.beginPath()
      ctx.arc(x, y, 8, 0, Math.PI * 2)
      ctx.fillStyle = d.improved ? '#00ffd4' : '#ef476f'
      ctx.fill()
      ctx.strokeStyle = '#0a0f1a'
      ctx.lineWidth = 3
      ctx.stroke()

      // Inner dot
      ctx.beginPath()
      ctx.arc(x, y, 3, 0, Math.PI * 2)
      ctx.fillStyle = '#0a0f1a'
      ctx.fill()

      // PnL label above point
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 12px system-ui'
      ctx.textAlign = 'center'
      ctx.fillText(`$${d.pnl.toFixed(0)}`, x, y - 16)

      // X-axis labels (hypothesis names)
      ctx.save()
      ctx.translate(x, height - padding.bottom + 12)
      ctx.rotate(-Math.PI / 4)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
      ctx.font = '10px system-ui'
      ctx.textAlign = 'right'
      ctx.fillText(d.hypothesis, 0, 0)
      ctx.restore()
    })

    // Title
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 14px system-ui'
    ctx.textAlign = 'left'
    ctx.fillText('PnL Improvement by Hypothesis', padding.left, 24)

    // Improvement annotation
    const lastData = data[data.length - 1]
    const firstData = data[0]
    const improvement = lastData.pnl - firstData.pnl
    const pctImprovement = ((lastData.pnl / firstData.pnl - 1) * 100).toFixed(0)
    ctx.fillStyle = '#00ffd4'
    ctx.font = '12px system-ui'
    ctx.textAlign = 'right'
    ctx.fillText(`+$${improvement.toFixed(0)} (+${pctImprovement}%) total improvement`, width - padding.right, 24)

  }, [data])

  return (
    <div className="card">
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '320px' }}
      />
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-3">
        {data.map((d, i) => (
          <div key={i} className="text-center p-2 rounded-lg" style={{ background: 'rgba(0, 255, 212, 0.05)' }}>
            <div className="text-xs text-muted mb-1">{d.hypothesis}</div>
            <div className="text-sm font-bold" style={{ color: d.improved ? '#00ffd4' : '#ef476f' }}>
              ${d.pnl.toFixed(0)}
            </div>
            <div className="text-xs text-muted">{(d.winRate * 100).toFixed(1)}% WR</div>
          </div>
        ))}
      </div>
    </div>
  )
}
