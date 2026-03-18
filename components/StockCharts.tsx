'use client'

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
} from 'chart.js'
import { Line } from 'react-chartjs-2'

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

interface Props {
  portfolioHistory: {
    timestamp: number[]
    equity: number[]
    profit_loss: number[]
    profit_loss_pct: number[]
  }
}

export default function StockCharts({ portfolioHistory }: Props) {
  const labels = portfolioHistory.timestamp.map(ts => {
    const date = new Date(ts * 1000)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  })

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Equity',
        data: portfolioHistory.equity,
        borderColor: '#00ffd4',
        backgroundColor: 'rgba(0, 255, 212, 0.1)',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 6,
        fill: true,
        tension: 0.3,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: '#1a1f2e',
        titleColor: '#ffffff',
        bodyColor: '#a0a0a0',
        borderColor: '#00ffd4',
        borderWidth: 1,
        padding: 12,
        displayColors: false,
        callbacks: {
          label: (item: { dataIndex: number; raw: unknown }) => {
            const pl = portfolioHistory.profit_loss[item.dataIndex]
            const plPct = portfolioHistory.profit_loss_pct[item.dataIndex] * 100
            const rawVal = item.raw as number
            return [
              `Equity: $${rawVal.toLocaleString()}`,
              `P&L: ${pl >= 0 ? '+' : ''}$${pl.toLocaleString()}`,
              `Return: ${plPct >= 0 ? '+' : ''}${plPct.toFixed(2)}%`,
            ]
          },
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
          maxTicksLimit: 10,
        },
      },
      y: {
        grid: {
          color: 'rgba(255, 255, 255, 0.05)',
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.5)',
          callback: (value: number | string) => `$${Number(value).toLocaleString()}`,
        },
      },
    },
    interaction: {
      intersect: false,
      mode: 'index' as const,
    },
  }

  // Calculate stats
  const startEquity = portfolioHistory.equity[0] || 100000
  const endEquity = portfolioHistory.equity[portfolioHistory.equity.length - 1] || 100000
  const totalReturn = ((endEquity - startEquity) / startEquity) * 100
  const maxEquity = Math.max(...portfolioHistory.equity)
  const minEquity = Math.min(...portfolioHistory.equity)
  const drawdown = ((maxEquity - minEquity) / maxEquity) * 100

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-4">
        <div className="flex gap-6">
          <div>
            <div className="text-xs text-muted">Start</div>
            <div className="text-sm font-mono">${startEquity.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-xs text-muted">Current</div>
            <div className="text-sm font-mono">${endEquity.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-xs text-muted">Return</div>
            <div className="text-sm font-mono" style={{ color: totalReturn >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {totalReturn >= 0 ? '+' : ''}{totalReturn.toFixed(2)}%
            </div>
          </div>
          <div>
            <div className="text-xs text-muted">Max Drawdown</div>
            <div className="text-sm font-mono" style={{ color: 'var(--red)' }}>
              -{drawdown.toFixed(2)}%
            </div>
          </div>
        </div>
      </div>
      <div style={{ height: '300px' }}>
        <Line data={chartData} options={options} />
      </div>
    </div>
  )
}
