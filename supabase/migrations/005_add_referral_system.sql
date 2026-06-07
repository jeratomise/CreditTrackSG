-- Add referral columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pro_months_earned INTEGER NOT NULL DEFAULT 0;

-- Auto-generate 8-char uppercase referral code on new profile insert
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TRIGGER AS $$
DECLARE
  code TEXT;
  exists_check BOOLEAN;
BEGIN
  -- Only generate if not already set
  IF NEW.referral_code IS NULL OR NEW.referral_code = '' THEN
    LOOP
      -- Generate random 8-char uppercase code
      code := upper(substring('ABCDEFGHJKLMNPQRSTUVWXYZ23456789' FROM floor(random() * 26 + 1)::int FOR 1) ||
               substring('ABCDEFGHJKLMNPQRSTUVWXYZ23456789' FROM floor(random() * 32 + 1)::int FOR 1) ||
               substring('ABCDEFGHJKLMNPQRSTUVWXYZ23456789' FROM floor(random() * 32 + 1)::int FOR 1) ||
               substring('ABCDEFGHJKLMNPQRSTUVWXYZ23456789' FROM floor(random() * 32 + 1)::int FOR 1) ||
               substring('ABCDEFGHJKLMNPQRSTUVWXYZ23456789' FROM floor(random() * 32 + 1)::int FOR 1) ||
               substring('ABCDEFGHJKLMNPQRSTUVWXYZ23456789' FROM floor(random() * 32 + 1)::int FOR 1) ||
               substring('ABCDEFGHJKLMNPQRSTUVWXYZ23456789' FROM floor(random() * 32 + 1)::int FOR 1) ||
               substring('ABCDEFGHJKLMNPQRSTUVWXYZ23456789' FROM floor(random() * 32 + 1)::int FOR 1));

      -- Check uniqueness
      SELECT EXISTS(SELECT 1 FROM profiles WHERE referral_code = code) INTO exists_check;
      EXIT WHEN NOT exists_check;
    END LOOP;

    NEW.referral_code := code;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_referral_code
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION generate_referral_code();

-- Create referrals table
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referral_code_used TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'converted', 'rewarded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  converted_at TIMESTAMPTZ,
  UNIQUE(referee_id) -- one referral per referee
);

-- RLS for referrals
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

-- Users can view their own referrals (as referrer)
DROP POLICY IF EXISTS "Users can view their own referrals as referrer" ON referrals;
CREATE POLICY "Users can view their own referrals as referrer" ON referrals
  FOR SELECT USING (auth.uid() = referrer_id);

-- Users can insert referrals for themselves (as referee) — but this is handled server-side
DROP POLICY IF EXISTS "Users can insert referrals" ON referrals;
CREATE POLICY "Users can insert referrals" ON referrals
  FOR INSERT WITH CHECK (auth.uid() = referee_id);

-- Enable RLS on profiles for referral_code and pro_months_earned columns
-- (existing policies already allow users to read their own profile, just ensure it)
DROP POLICY IF EXISTS "Users can view their own profile referral fields" ON profiles;
CREATE POLICY "Users can view their own profile referral fields" ON profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile referral fields" ON profiles;
CREATE POLICY "Users can update their own profile referral fields" ON profiles
  FOR UPDATE USING (auth.uid() = id);