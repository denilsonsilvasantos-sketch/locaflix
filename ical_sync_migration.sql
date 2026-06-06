-- ============================================================
-- MIGRATION: Sincronização iCal — Locaflix
-- Execute no SQL Editor do Supabase
-- ============================================================

-- 1. Adicionar campos de URL iCal + metadados de sync na tabela properties
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS ical_airbnb_url       text,
  ADD COLUMN IF NOT EXISTS ical_booking_url      text,
  ADD COLUMN IF NOT EXISTS ical_last_sync_airbnb timestamptz,
  ADD COLUMN IF NOT EXISTS ical_last_sync_booking timestamptz,
  ADD COLUMN IF NOT EXISTS ical_sync_error_airbnb text,
  ADD COLUMN IF NOT EXISTS ical_sync_error_booking text;

-- 2. Tabela de eventos importados de calendários externos
CREATE TABLE IF NOT EXISTS calendar_syncs (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id       uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  provider          text NOT NULL CHECK (provider IN ('AIRBNB', 'BOOKING')),
  external_event_id text NOT NULL,
  start_date        date NOT NULL,
  end_date          date NOT NULL,
  summary           text,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now(),
  UNIQUE(property_id, provider, external_event_id)
);

-- 3. Tabela unificada de bloqueios de calendário
CREATE TABLE IF NOT EXISTS calendar_blocks (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  source      text NOT NULL CHECK (source IN ('LOCAFLIX', 'AIRBNB', 'BOOKING', 'MANUAL')),
  start_date  date NOT NULL,
  end_date    date NOT NULL,
  notes       text,
  sync_id     uuid REFERENCES calendar_syncs(id) ON DELETE CASCADE,
  created_at  timestamptz DEFAULT now()
);

-- 4. Índices para buscas por data
CREATE INDEX IF NOT EXISTS idx_calendar_blocks_property_dates
  ON calendar_blocks(property_id, start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_calendar_blocks_source
  ON calendar_blocks(property_id, source);

CREATE INDEX IF NOT EXISTS idx_calendar_syncs_property_provider
  ON calendar_syncs(property_id, provider);

-- 5. RLS — calendar_blocks (anfitrião vê apenas seus imóveis)
ALTER TABLE calendar_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "calendar_blocks_owner_read"
  ON calendar_blocks FOR SELECT
  USING (
    property_id IN (
      SELECT id FROM properties WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS "calendar_blocks_owner_insert"
  ON calendar_blocks FOR INSERT
  WITH CHECK (
    property_id IN (
      SELECT id FROM properties WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS "calendar_blocks_owner_delete"
  ON calendar_blocks FOR DELETE
  USING (
    property_id IN (
      SELECT id FROM properties WHERE owner_id = auth.uid()
    )
  );

-- Permitir leitura pública de calendar_blocks (para checagem de disponibilidade)
CREATE POLICY IF NOT EXISTS "calendar_blocks_public_read"
  ON calendar_blocks FOR SELECT
  USING (true);

-- 6. RLS — calendar_syncs
ALTER TABLE calendar_syncs ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "calendar_syncs_owner_read"
  ON calendar_syncs FOR SELECT
  USING (
    property_id IN (
      SELECT id FROM properties WHERE owner_id = auth.uid()
    )
  );

-- Permitir leitura pública de calendar_syncs
CREATE POLICY IF NOT EXISTS "calendar_syncs_public_read"
  ON calendar_syncs FOR SELECT
  USING (true);
