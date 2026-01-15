-- This SQL can be run in the Supabase SQL Editor to create the wallet associations table
-- and the function to create it programmatically if it doesn't exist

-- First, create the table if it doesn't exist
CREATE TABLE IF NOT EXISTS wallet_associations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  signature TEXT NOT NULL,
  message TEXT NOT NULL,
  chain_id INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Create a unique constraint to prevent duplicate associations
  CONSTRAINT unique_user_wallet UNIQUE (user_id, wallet_address)
);

-- Create an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_wallet_associations_user_id ON wallet_associations(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_associations_wallet_address ON wallet_associations(wallet_address);

-- Add Row Level Security policies to protect the data
ALTER TABLE wallet_associations ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to see only their own wallet associations
CREATE POLICY select_own_wallet_associations ON wallet_associations
  FOR SELECT USING (auth.uid() = user_id);

-- Policy to allow users to insert only their own wallet associations
CREATE POLICY insert_own_wallet_associations ON wallet_associations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Now create a function that can be called from the client to create the table if needed
CREATE OR REPLACE FUNCTION create_wallet_associations_table()
RETURNS void AS $$
BEGIN
  -- Check if the table already exists
  IF NOT EXISTS (
    SELECT FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'wallet_associations'
  ) THEN
    -- Create the table
    EXECUTE '
      CREATE TABLE public.wallet_associations (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        wallet_address TEXT NOT NULL,
        signature TEXT NOT NULL,
        message TEXT NOT NULL,
        chain_id INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
        CONSTRAINT unique_user_wallet UNIQUE (user_id, wallet_address)
      );
      
      CREATE INDEX idx_wallet_associations_user_id ON public.wallet_associations(user_id);
      CREATE INDEX idx_wallet_associations_wallet_address ON public.wallet_associations(wallet_address);
      
      ALTER TABLE public.wallet_associations ENABLE ROW LEVEL SECURITY;
      
      CREATE POLICY select_own_wallet_associations ON public.wallet_associations
        FOR SELECT USING (auth.uid() = user_id);
      
      CREATE POLICY insert_own_wallet_associations ON public.wallet_associations
        FOR INSERT WITH CHECK (auth.uid() = user_id);
    ';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Example to create a function that lets users look up if an address is verified
CREATE OR REPLACE FUNCTION is_wallet_verified(wallet text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM wallet_associations 
    WHERE wallet_address = LOWER(wallet)
    AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 