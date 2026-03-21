-- Run this in Supabase SQL Editor (https://supabase.com/dashboard/project/rvxteuojvgkdjgbupcts/sql/new)

CREATE TABLE IF NOT EXISTS dashboard_visitors (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamptz DEFAULT now(),
    ip text,
    country text,
    city text,
    region text,
    user_agent text,
    referrer text,
    page text,
    name text,
    device_type text,
    browser text,
    os text,
    screen_width int,
    screen_height int,
    timezone text,
    language text,
    session_id text
);

-- Index for querying by session
CREATE INDEX IF NOT EXISTS idx_visitors_session ON dashboard_visitors(session_id);

-- Index for time-based queries
CREATE INDEX IF NOT EXISTS idx_visitors_created ON dashboard_visitors(created_at DESC);

-- Enable RLS but allow service role full access
ALTER TABLE dashboard_visitors ENABLE ROW LEVEL SECURITY;

-- Policy for service role (API routes)
CREATE POLICY "Service role can do everything" ON dashboard_visitors
    FOR ALL
    USING (true)
    WITH CHECK (true);
