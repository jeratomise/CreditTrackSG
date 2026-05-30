-- Add admin bypass policy for profiles
CREATE POLICY "Admins can update any profile" ON profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Ensure annual_fees RLS is properly configured
ALTER TABLE annual_fees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own annual fees" ON annual_fees;
CREATE POLICY "Users can view their own annual fees" ON annual_fees
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own annual fees" ON annual_fees;
CREATE POLICY "Users can insert their own annual fees" ON annual_fees
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own annual fees" ON annual_fees;
CREATE POLICY "Users can update their own annual fees" ON annual_fees
  FOR UPDATE USING (auth.uid() = user_id);