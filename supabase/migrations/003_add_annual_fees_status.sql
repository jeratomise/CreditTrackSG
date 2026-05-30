-- Add status column to annual_fees table
ALTER TABLE annual_fees ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'waived', 'ignored'));

-- Update RLS policies to account for status
DROP POLICY IF EXISTS "Users can update their own annual fees" ON annual_fees;
CREATE POLICY "Users can update their own annual fees" ON annual_fees
  FOR UPDATE USING (auth.uid() = user_id);

-- Add index on status for faster filtering
CREATE INDEX IF NOT EXISTS idx_annual_fees_status ON annual_fees(status);