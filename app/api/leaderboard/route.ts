import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  'https://rvxteuojvgkdjgbupcts.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2eHRldW9qdmdrZGpnYnVwY3RzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzU1MTQxMywiZXhwIjoyMDg5MTI3NDEzfQ.rgCOE_w5SUCQQ503dT646wNs5f3dMd6fTu3Fqmx6mKA'
)

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('experiment_leaderboard')
      .select('*')
      .order('pnl', { ascending: false })
      .limit(50)
    
    if (error) {
      console.error('Leaderboard fetch error:', error)
      return NextResponse.json([])
    }
    
    // Add ranks
    const ranked = (data || []).map((entry, i) => ({
      ...entry,
      rank: i + 1
    }))
    
    return NextResponse.json(ranked)
  } catch (e) {
    console.error('Leaderboard error:', e)
    return NextResponse.json([])
  }
}
