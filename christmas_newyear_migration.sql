-- Migration: Split CHRISTMAS_NEW_YEAR into CHRISTMAS and NEW_YEAR
-- Run this in Supabase SQL Editor before using the new period types

-- Add new values to the pricing_rule_type enum
ALTER TYPE pricing_rule_type ADD VALUE IF NOT EXISTS 'CHRISTMAS';
ALTER TYPE pricing_rule_type ADD VALUE IF NOT EXISTS 'NEW_YEAR';

-- After running this migration:
-- 1. In each property's "Preços por período", DELETE the old "Natal / Réveillon" period
-- 2. Create a new "Natal" period with type CHRISTMAS (20/dez – 27/dez)
-- 3. Create a new "Réveillon" period with type NEW_YEAR (28/dez – 03/jan)
-- The old CHRISTMAS_NEW_YEAR type remains valid for any existing records not yet updated.
