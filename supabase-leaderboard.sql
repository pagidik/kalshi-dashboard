-- Run this in Supabase SQL Editor
-- https://supabase.com/dashboard/project/rvxteuojvgkdjgbupcts/sql/new

CREATE TABLE experiment_leaderboard (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamptz DEFAULT now(),
    name text NOT NULL,
    hypothesis text NOT NULL,
    implied_min numeric,
    implied_max numeric,
    min_trade numeric,
    pnl numeric,
    win_rate numeric,
    trades int,
    rank int,
    is_best boolean DEFAULT false,
    status text DEFAULT 'pending' -- pending, running, complete, error
);

CREATE INDEX idx_leaderboard_pnl ON experiment_leaderboard(pnl DESC);
CREATE INDEX idx_leaderboard_name ON experiment_leaderboard(name);
