-- ============================================================
-- LOCAFLIX — Limpeza de tabelas obsoletas
-- Execute no Supabase SQL Editor
-- ATENÇÃO: irreversível — faça backup antes se houver dados importantes
-- ============================================================

-- Tabelas substituídas ou sem uso no código:
-- availability_blocks → substituída por blocked_dates
-- property_pricing_rules → substituída por price_periods
-- admin_audit_log → não referenciada no código
-- sinistros → substituída por incidents + incident_messages

DROP TABLE IF EXISTS public.availability_blocks    CASCADE;
DROP TABLE IF EXISTS public.property_pricing_rules CASCADE;
DROP TABLE IF EXISTS public.admin_audit_log        CASCADE;
DROP TABLE IF EXISTS public.sinistros              CASCADE;
