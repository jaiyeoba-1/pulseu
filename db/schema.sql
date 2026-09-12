CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth0_user_id TEXT UNIQUE NOT NULL, display_name TEXT,
  timezone TEXT NOT NULL DEFAULT 'America/Chicago',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS daily_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_date DATE NOT NULL, sleep_hours NUMERIC(3,1),
  initial_energy INTEGER, initial_mood INTEGER, tasks_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE (user_id, plan_date));
CREATE TABLE IF NOT EXISTS student_events (
  time TIMESTAMPTZ NOT NULL, user_id UUID NOT NULL, event_type TEXT NOT NULL,
  numeric_value NUMERIC, metadata JSONB NOT NULL DEFAULT '{}'::jsonb);
SELECT create_hypertable('student_events','time',if_not_exists=>TRUE);
CREATE INDEX IF NOT EXISTS student_events_user_time_idx ON student_events (user_id, time DESC);
CREATE TABLE IF NOT EXISTS recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  risk_score INTEGER, risk_level TEXT, payload JSONB NOT NULL);
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_stats
WITH (timescaledb.continuous) AS
SELECT time_bucket('1 day', time) AS day, user_id,
  AVG(numeric_value) FILTER (WHERE event_type='energy_checkin') AS avg_energy,
  MIN(numeric_value) FILTER (WHERE event_type='energy_checkin') AS min_energy,
  SUM(numeric_value) FILTER (WHERE event_type='study_completed') AS study_minutes,
  COUNT(*) FILTER (WHERE event_type='break_logged') AS breaks,
  COUNT(*) FILTER (WHERE event_type='meal_logged') AS meals,
  COUNT(*) AS total_events
FROM student_events GROUP BY day, user_id WITH NO DATA;
SELECT add_continuous_aggregate_policy('daily_stats',
  start_offset=>INTERVAL '60 days', end_offset=>INTERVAL '1 hour',
  schedule_interval=>INTERVAL '1 hour', if_not_exists=>TRUE);
