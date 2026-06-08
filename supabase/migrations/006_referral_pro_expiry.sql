-- Add Pro expiry column to profiles (for time-limited Pro grants like referee rewards)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS pro_expires_at TIMESTAMPTZ;

-- Index for the daily cron that downgrades expired Pro accounts
CREATE INDEX IF NOT EXISTS idx_profiles_pro_expires_at
  ON profiles(pro_expires_at)
  WHERE pro_expires_at IS NOT NULL;
