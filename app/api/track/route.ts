import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  'https://rvxteuojvgkdjgbupcts.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2eHRldW9qdmdrZGpnYnVwY3RzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzU1MTQxMywiZXhwIjoyMDg5MTI3NDEzfQ.rgCOE_w5SUCQQ503dT646wNs5f3dMd6fTu3Fqmx6mKA'
)

// Parse user agent for device/browser/os
function parseUserAgent(ua: string): { device: string; browser: string; os: string } {
  const device = /Mobile|Android|iPhone|iPad/i.test(ua) ? 'mobile' : 'desktop'
  
  let browser = 'unknown'
  if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome'
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari'
  else if (ua.includes('Firefox')) browser = 'Firefox'
  else if (ua.includes('Edg')) browser = 'Edge'
  
  let os = 'unknown'
  if (ua.includes('Windows')) os = 'Windows'
  else if (ua.includes('Mac OS')) os = 'macOS'
  else if (ua.includes('Linux')) os = 'Linux'
  else if (ua.includes('Android')) os = 'Android'
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS'
  
  return { device, browser, os }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const headers = req.headers
    
    // Get IP from various headers (Vercel uses x-forwarded-for)
    const ip = headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
               headers.get('x-real-ip') || 
               'unknown'
    
    const userAgent = headers.get('user-agent') || ''
    const { device, browser, os } = parseUserAgent(userAgent)
    
    // Get geo data from Vercel's edge headers
    const country = headers.get('x-vercel-ip-country') || body.country || null
    const city = headers.get('x-vercel-ip-city') || body.city || null
    const region = headers.get('x-vercel-ip-country-region') || body.region || null
    
    const visitor = {
      ip,
      country,
      city,
      region,
      user_agent: userAgent,
      referrer: body.referrer || null,
      page: body.page || '/',
      name: body.name || null,
      device_type: device,
      browser,
      os,
      screen_width: body.screenWidth || null,
      screen_height: body.screenHeight || null,
      timezone: body.timezone || null,
      language: body.language || null,
      session_id: body.sessionId || null,
    }
    
    const { error } = await supabase
      .from('dashboard_visitors')
      .insert([visitor])
    
    if (error) {
      console.error('Track error:', error)
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Track error:', e)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}

// Also handle name submissions
export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    const { sessionId, name } = body
    
    if (!sessionId || !name) {
      return NextResponse.json({ ok: false, error: 'Missing sessionId or name' }, { status: 400 })
    }
    
    // Update the most recent visit with this session to add the name
    const { error } = await supabase
      .from('dashboard_visitors')
      .update({ name })
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(1)
    
    if (error) {
      console.error('Name update error:', error)
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Name update error:', e)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
