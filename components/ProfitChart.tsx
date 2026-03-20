'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartOptions,
  TooltipItem,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { Prediction } from '../lib/predictions'

// Register base Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

interface ChartDataPoint {
  x: number
  y: number
  market: string
  pnl: number
  status: string
  impliedPct: number
  side: string
  settledAt: string
  cumPnl: number
  dollarObserved: number
}

interface ProfitChartProps {
  predictions: Prediction[]
  configStats?: {
    wins: number
    losses: number
    totalPnl: number
    winRate: number
  }
}

export default function ProfitChart({ predictions, configStats }: ProfitChartProps) {
  const chartRef = useRef<ChartJS<'line'>>(null)
  const [isZoomed, setIsZoomed] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Detect mobile and listen for resize
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Register zoom plugin only on client
  useEffect(() => {
    import('chartjs-plugin-zoom').then((zoomPlugin) => {
      ChartJS.register(zoomPlugin.default)
    })
  }, [])

  const settled = predictions
    .filter(p => p.status === 'won' || p.status === 'lost')
    .sort((a, b) => new Date(a.firedAt).getTime() - new Date(b.firedAt).getTime())

  // Build cumulative P&L with full data
  const points: ChartDataPoint[] = []
  let cumPnl = 0
  settled.forEach((p, i) => {
    cumPnl += p.pnl ?? 0
    points.push({
      x: i,
      y: cumPnl,
      market: p.market,
      pnl: p.pnl ?? 0,
      status: p.status,
      impliedPct: p.impliedPct,
      side: p.side,
      settledAt: p.settledAt || p.firedAt,
      cumPnl,
      dollarObserved: p.dollarObserved
    })
  })

  const labels = points.map((_, i) => `#${i + 1}`)

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Cumulative P&L',
        data: points.map(p => p.y),
        borderColor: '#00ffd4',
        backgroundColor: (context: { chart: ChartJS }) => {
          const chart = context.chart
          const { ctx, chartArea } = chart
          if (!chartArea) return 'rgba(0, 255, 212, 0.1)'
          const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top)
          gradient.addColorStop(0, 'rgba(0, 255, 212, 0)')
          gradient.addColorStop(1, 'rgba(0, 255, 212, 0.3)')
          return gradient
        },
        borderWidth: isMobile ? 2 : 2.5,
        pointRadius: isMobile ? 3 : 5,
        pointHoverRadius: isMobile ? 6 : 10,
        pointBackgroundColor: points.map(p => p.status === 'won' ? '#06d6a0' : '#ef476f'),
        pointBorderColor: '#0a0f1a',
        pointBorderWidth: isMobile ? 1 : 2,
        fill: true,
        tension: 0.2,
      },
    ],
  }

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'nearest',
      intersect: true,
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        enabled: true,
        backgroundColor: '#1a1f2e',
        titleColor: '#ffffff',
        bodyColor: '#a0a0a0',
        borderColor: '#00ffd4',
        borderWidth: 1,
        padding: isMobile ? 10 : 16,
        displayColors: false,
        titleFont: { size: isMobile ? 11 : 13, weight: 'bold' },
        bodyFont: { size: isMobile ? 10 : 12 },
        callbacks: {
          title: (items: TooltipItem<'line'>[]) => {
            const idx = items[0].dataIndex
            const point = points[idx]
            // Truncate long market names on mobile
            return isMobile && point.market.length > 40
              ? point.market.substring(0, 38) + '…'
              : point.market
          },
          afterTitle: (items: TooltipItem<'line'>[]) => {
            const idx = items[0].dataIndex
            return `Bet #${idx + 1}`
          },
          label: (item: TooltipItem<'line'>) => {
            const point = points[item.dataIndex]
            return [
              ``,
              `Side: ${point.side}`,
              `Implied: ${point.impliedPct}%`,
              `Trade Size: $${point.dollarObserved.toLocaleString()}`,
              `P&L: ${point.pnl >= 0 ? '+' : ''}$${point.pnl.toFixed(2)}`,
              `Cumulative: ${point.cumPnl >= 0 ? '+' : ''}$${point.cumPnl.toFixed(2)}`,
              `Result: ${point.status.toUpperCase()}`,
              `Settled: ${new Date(point.settledAt).toLocaleDateString()}`,
            ]
          },
        },
      },
      zoom: {
        pan: {
          enabled: true,
          mode: 'xy',
          threshold: 5,
        },
        zoom: {
          wheel: {
            // Disable scroll-to-zoom on mobile (use pinch instead)
            enabled: !isMobile,
            speed: 0.1,
          },
          pinch: {
            enabled: true,
          },
          mode: 'xy',
          onZoomComplete: () => setIsZoomed(true),
        },
      },
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(255, 255, 255, 0.05)',
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.5)',
          // Reduce tick density significantly on mobile
          maxTicksLimit: isMobile ? 6 : 15,
          font: { size: isMobile ? 9 : 10 },
          maxRotation: isMobile ? 0 : 0,
          minRotation: 0,
        },
      },
      y: {
        grid: {
          color: 'rgba(255, 255, 255, 0.05)',
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.5)',
          callback: (value) => isMobile ? `$${value}` : `$${value}`,
          font: { size: isMobile ? 9 : 11 },
          // Fewer y ticks on mobile to avoid crowding
          maxTicksLimit: isMobile ? 5 : 8,
        },
      },
    },
    onHover: (event, elements, chart) => {
      if (elements.length > 0) {
        chart.canvas.style.cursor = 'pointer'
      } else {
        chart.canvas.style.cursor = isMobile ? 'default' : 'grab'
      }
    },
  }

  const resetZoom = () => {
    if (chartRef.current) {
      chartRef.current.resetZoom()
      setIsZoomed(false)
    }
  }

  // Use config stats if provided, otherwise compute from chart data
  const totalPnl = configStats?.totalPnl ?? (points.length > 0 ? points[points.length - 1].cumPnl : 0)
  const wins = configStats?.wins ?? points.filter(p => p.status === 'won').length
  const losses = configStats?.losses ?? points.filter(p => p.status === 'lost').length
  const winRate = configStats?.winRate ?? (points.length > 0 ? (wins / (wins + losses)) * 100 : 0)
  const maxDrawdown = Math.min(0, ...points.map(p => p.cumPnl))
  const maxProfit = Math.max(0, ...points.map(p => p.cumPnl))

  return (
    <div className="rounded-xl border border-border bg-surface p-4 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg md:text-xl font-semibold text-text">Profit Over Time</h2>
          <p className="text-xs text-text-muted hidden sm:block">Scroll to zoom, drag to pan, hover dots for details</p>
          <p className="text-xs text-text-muted sm:hidden">Pinch to zoom · tap dots for details</p>
        </div>
        <div className="flex items-center gap-2 md:gap-4">
          {isZoomed && (
            <button
              onClick={resetZoom}
              className="px-3 py-1 text-xs rounded-full border transition-colors hover:opacity-80"
              style={{ borderColor: 'rgba(0,255,212,0.3)', color: 'var(--accent)', background: 'rgba(0,255,212,0.06)' }}
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Stats bar — 2-col grid on mobile, 5-col on desktop */}
      <div
        className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-4 mb-4 sm:mb-6 p-3 sm:p-4 rounded-lg"
        style={{ background: 'rgba(0, 255, 212, 0.03)', border: '1px solid rgba(0, 255, 212, 0.1)' }}
      >
        <div className="text-center py-1">
          <div className="text-xs text-muted mb-1">Total P&L</div>
          <div className="text-base md:text-lg font-bold" style={{ color: totalPnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {totalPnl >= 0 ? '+' : ''}${Math.abs(totalPnl).toFixed(0)}
          </div>
        </div>
        <div className="text-center py-1">
          <div className="text-xs text-muted mb-1">Win Rate</div>
          <div className="text-base md:text-lg font-bold text-accent">{winRate.toFixed(1)}%</div>
        </div>
        <div className="text-center py-1">
          <div className="text-xs text-muted mb-1">Record</div>
          <div className="text-base md:text-lg font-bold">
            <span style={{ color: 'var(--green)' }}>{wins}W</span>
            <span className="text-muted mx-1">/</span>
            <span style={{ color: 'var(--red)' }}>{losses}L</span>
          </div>
        </div>
        <div className="text-center py-1">
          <div className="text-xs text-muted mb-1">Max Profit</div>
          <div className="text-base md:text-lg font-bold" style={{ color: 'var(--green)' }}>+${maxProfit.toFixed(0)}</div>
        </div>
        {/* On mobile: span full width for last card to center it in the 2-col grid */}
        <div className="text-center py-1 col-span-2 sm:col-span-1">
          <div className="text-xs text-muted mb-1">Max Drawdown</div>
          <div className="text-base md:text-lg font-bold" style={{ color: 'var(--red)' }}>${maxDrawdown.toFixed(0)}</div>
        </div>
      </div>

      {/* Chart — shorter on mobile */}
      <div
        className="relative"
        style={{ height: isMobile ? '240px' : '350px' }}
      >
        <Line ref={chartRef} data={chartData} options={options} />
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 sm:gap-6 mt-3 sm:mt-4 text-xs text-muted">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full" style={{ background: '#06d6a0' }} />
          <span>Win</span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full" style={{ background: '#ef476f' }} />
          <span>Loss</span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="w-4 h-0.5" style={{ background: '#00ffd4' }} />
          <span>Cumulative P&L</span>
        </div>
      </div>
    </div>
  )
}
