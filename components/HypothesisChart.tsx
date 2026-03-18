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
  const chartData = {
    labels: data.map(d => d.hypothesis),
    datasets: [
      {
        label: 'PnL ($)',
        data: data.map(d => d.pnl),
        borderColor: '#00ffd4',
        backgroundColor: 'rgba(0, 255, 212, 0.1)',
        borderWidth: 3,
        pointRadius: 8,
        pointBackgroundColor: data.map(d => d.improved ? '#00ffd4' : '#ef476f'),
        pointBorderColor: '#0a0f1a',
        pointBorderWidth: 3,
        pointHoverRadius: 10,
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
      title: {
        display: true,
        text: 'PnL Improvement by Hypothesis',
        color: '#ffffff',
        font: {
          size: 14,
          weight: 'bold' as const,
        },
        padding: { bottom: 20 },
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
          title: (items: { dataIndex: number }[]) => {
            const idx = items[0].dataIndex
            return data[idx].hypothesis
          },
          label: (item: { dataIndex: number }) => {
            const d = data[item.dataIndex]
            return [
              `PnL: $${d.pnl.toFixed(0)}`,
              `Win Rate: ${(d.winRate * 100).toFixed(1)}%`,
              `Brier: ${d.brier.toFixed(4)}`,
              `Samples: ${d.samples}`,
              `${d.description}`,
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
          color: 'rgba(255, 255, 255, 0.7)',
          font: { size: 10 },
          maxRotation: 45,
          minRotation: 45,
        },
      },
      y: {
        grid: {
          color: 'rgba(255, 255, 255, 0.05)',
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.5)',
          callback: (value: number | string) => `$${value}`,
        },
        beginAtZero: true,
      },
    },
  }

  // Calculate improvement stats
  const lastData = data[data.length - 1]
  const firstData = data[0]
  const improvement = lastData.pnl - firstData.pnl
  const pctImprovement = ((lastData.pnl / firstData.pnl - 1) * 100).toFixed(0)

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-4">
        <span className="text-sm text-muted">Wave {data.length} experiments</span>
        <span className="text-sm font-semibold" style={{ color: '#00ffd4' }}>
          +${improvement.toFixed(0)} (+{pctImprovement}%) total improvement
        </span>
      </div>
      <div style={{ height: '320px' }}>
        <Line data={chartData} options={options} />
      </div>
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
