-- Migration: add rejection_reason to properties
-- Run in Supabase SQL Editor

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
