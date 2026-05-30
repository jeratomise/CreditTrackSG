-- Migration: Create annual_fees table
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS annual_fees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  card_name TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  charge_month INTEGER NOT NULL CHECK (charge_month BETWEEN 1 AND 12),
  charge_year INTEGER NOT NULL,
  is_recurring BOOLEAN DEFAULT false,
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, bank_name, card_name, charge_month)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_annual_fees_user_id ON annual_fees(user_id);
CREATE INDEX IF NOT EXISTS idx_annual_fees_charge_year_month ON annual_fees(charge_year, charge_month);

-- RLS policies
ALTER TABLE annual_fees ENABLE ROW LEVEL SECURITY;

-- Users can only see their own annual fees
CREATE POLICY "Users can view their own annual fees" ON annual_fees
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own annual fees" ON annual_fees
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own annual fees" ON annual_fees
  FOR UPDATE USING (auth.uid() = user_id);