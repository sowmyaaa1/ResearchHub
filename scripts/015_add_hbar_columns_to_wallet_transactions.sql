-- Add missing columns to wallet_transactions table for HBAR integration
ALTER TABLE public.wallet_transactions 
ADD COLUMN IF NOT EXISTS hbar_transaction_id TEXT,
ADD COLUMN IF NOT EXISTS hbar_status TEXT;