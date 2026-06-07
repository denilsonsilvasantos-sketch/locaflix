-- ============================================================
-- ETAPA 5 — Pagamento por Cartão de Crédito
-- Execute no SQL Editor do Supabase ANTES de fazer deploy
-- ============================================================

-- 1. Tabela de configuração de taxas de cartão (por número de parcelas)
CREATE TABLE IF NOT EXISTS payment_settings (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  installments INT           NOT NULL UNIQUE,
  fee_percent  NUMERIC(5,2) NOT NULL DEFAULT 0,
  label        TEXT,
  created_at   TIMESTAMPTZ  DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  DEFAULT NOW()
);

-- 2. Taxas padrão (1x sem taxa, 2x–6x com taxa repassada ao cliente)
INSERT INTO payment_settings (installments, fee_percent, label) VALUES
  (1, 0.00,  'À vista'),
  (2, 3.50,  '2x'),
  (3, 5.20,  '3x'),
  (4, 7.20,  '4x'),
  (5, 9.40,  '5x'),
  (6, 11.50, '6x')
ON CONFLICT (installments) DO NOTHING;

-- 3. Colunas de cartão na tabela bookings
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS payment_method    TEXT          DEFAULT 'PIX',
  ADD COLUMN IF NOT EXISTS card_installments INT,
  ADD COLUMN IF NOT EXISTS card_fee_percent  NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS card_fee_value    NUMERIC(10,2);

-- 4. RLS para payment_settings
ALTER TABLE payment_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone_read_payment_settings" ON payment_settings;
CREATE POLICY "anyone_read_payment_settings"
  ON payment_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "admin_write_payment_settings" ON payment_settings;
CREATE POLICY "admin_write_payment_settings"
  ON payment_settings FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'ADMIN')
  );

-- 5. Verificação
SELECT installments, fee_percent, label FROM payment_settings ORDER BY installments;
