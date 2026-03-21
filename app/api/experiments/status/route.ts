import { NextResponse } from 'next/server'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

export const dynamic = 'force-dynamic'

export async function GET() {
  const statusPath = join(process.cwd(), 'public', 'data', 'experiment-status.json')
  
  if (!existsSync(statusPath)) {
    return NextResponse.json({
      status: 'idle',
      currentExperiment: 0,
      totalExperiments: 0,
      bestPnl: 0,
      bestConfig: '',
      startedAt: '',
      experiments: [],
      log: ['Waiting for experiment runner to start...']
    })
  }
  
  try {
    const data = JSON.parse(readFileSync(statusPath, 'utf8'))
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({
      status: 'error',
      currentExperiment: 0,
      totalExperiments: 0,
      bestPnl: 0,
      bestConfig: '',
      startedAt: '',
      experiments: [],
      log: ['Error reading status file']
    })
  }
}
