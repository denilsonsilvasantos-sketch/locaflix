-- ============================================================
-- LOCAFLIX — Schema Supabase (versão idempotente — seguro reexecutar)
-- Atualizado para refletir todas as tabelas realmente em uso
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUMS (seguros contra duplicata)
-- ============================================================
DO $$ BEGIN CREATE TYPE user_role           AS ENUM ('GUEST', 'OWNER', 'ADMIN');                                                       EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE kyc_status          AS ENUM ('PENDENTE', 'APROVADO', 'REPROVADO', 'INCOMPLETO');                               EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE property_status     AS ENUM ('PENDENTE', 'ATIVO', 'INATIVO', 'REPROVADO');                                     EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE property_plan       AS ENUM ('STANDARD', 'DESTAQUE');                                                          EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE property_type       AS ENUM ('CASA', 'APARTAMENTO', 'CHALÉ', 'POUSADA', 'SÍTIO', 'COBERTURA', 'LOFT', 'STUDIO'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE cancellation_policy AS ENUM ('FLEXIVEL', 'MODERADO', 'FIRME');                                                 EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE booking_status      AS ENUM ('AGUARDANDO_PAGAMENTO', 'PARCIAL', 'PAGO', 'CONCLUIDA', 'CANCELADA');             EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE installment_status  AS ENUM ('PENDENTE', 'PAGO', 'ATRASADO', 'CANCELADO');                                     EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE installment_type    AS ENUM ('ENTRADA', 'PARCELA');                                                            EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE insurance_plan      AS ENUM ('NENHUM', 'BASICO', 'PADRAO', 'PREMIUM');                                         EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE review_mode         AS ENUM ('OWNER_RATES_GUEST', 'GUEST_RATES_PROPERTY');                                     EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE coupon_type         AS ENUM ('PERCENTUAL', 'FIXO');                                                            EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE pricing_rule_type   AS ENUM ('WEEKEND', 'HOLIDAY', 'SPECIAL', 'LOW_SEASON', 'HIGH_SEASON');                   EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE ownership_type      AS ENUM ('PROPRIO', 'TERCEIRO');                                                           EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE kinship_type        AS ENUM ('PAI', 'MAE', 'ESPOSO', 'ESPOSA', 'FILHO', 'FILHA', 'OUTRO');                    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- FUNÇÕES AUXILIARES
-- ============================================================
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'ADMIN');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- TABELAS
-- ============================================================

-- ---- users ----
CREATE TABLE IF NOT EXISTS public.users (
  id                        UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                     TEXT NOT NULL,
  name                      TEXT,
  role                      user_role NOT NULL DEFAULT 'GUEST',
  kyc_status                kyc_status NOT NULL DEFAULT 'INCOMPLETO',
  cpf                       TEXT,
  birth_date                DATE,
  phone                     TEXT,
  address                   TEXT,
  number                    TEXT,
  complement                TEXT,
  neighborhood              TEXT,
  city                      TEXT,
  state                     TEXT,
  cep                       TEXT,
  document_url              TEXT,
  address_proof_url         TEXT,
  avatar_url                TEXT,
  actual_owner_name         TEXT,
  actual_owner_cpf          TEXT,
  actual_owner_document_url TEXT,
  ownership_type            ownership_type,
  kinship_type              kinship_type,
  kinship_document_url      TEXT,
  tour_completed            BOOLEAN NOT NULL DEFAULT FALSE,
  cookie_accepted           BOOLEAN NOT NULL DEFAULT FALSE,
  terms_accepted_at         TIMESTAMPTZ,
  pix_key                   TEXT,
  bank_name                 TEXT,
  bank_agency               TEXT,
  bank_account              TEXT,
  bank_account_type         TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_updated_at_users ON public.users;
CREATE TRIGGER set_updated_at_users BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ---- properties ----
CREATE TABLE IF NOT EXISTS public.properties (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id            UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  description         TEXT,
  type                property_type NOT NULL DEFAULT 'CASA',
  status              property_status NOT NULL DEFAULT 'PENDENTE',
  plan                property_plan NOT NULL DEFAULT 'STANDARD',
  city                TEXT NOT NULL,
  state               TEXT NOT NULL,
  neighborhood        TEXT,
  address             TEXT,
  cep                 TEXT,
  number              TEXT,
  complement          TEXT,
  country             TEXT NOT NULL DEFAULT 'Brasil',
  latitude            NUMERIC(10,7),
  longitude           NUMERIC(10,7),
  price_per_night     NUMERIC(10,2) NOT NULL,
  min_price           NUMERIC(10,2),
  bedrooms            INT NOT NULL DEFAULT 1,
  bathrooms           INT NOT NULL DEFAULT 1,
  max_guests          INT NOT NULL DEFAULT 2,
  amenities           TEXT[] NOT NULL DEFAULT '{}',
  photos              TEXT[] NOT NULL DEFAULT '{}',
  cancellation_policy cancellation_policy NOT NULL DEFAULT 'MODERADO',
  rating              NUMERIC(3,2),
  reviews_count       INT NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_properties_status   ON public.properties(status);
CREATE INDEX IF NOT EXISTS idx_properties_owner_id ON public.properties(owner_id);
CREATE INDEX IF NOT EXISTS idx_properties_city     ON public.properties(city);
CREATE INDEX IF NOT EXISTS idx_properties_state    ON public.properties(state);

DROP TRIGGER IF EXISTS set_updated_at_properties ON public.properties;
CREATE TRIGGER set_updated_at_properties BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ---- amenities_catalog ----
CREATE TABLE IF NOT EXISTS public.amenities_catalog (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category      TEXT NOT NULL,
  name          TEXT NOT NULL,
  icon          TEXT,
  display_order INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- property_amenities ----
CREATE TABLE IF NOT EXISTS public.property_amenities (
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  amenity_id  UUID NOT NULL REFERENCES public.amenities_catalog(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (property_id, amenity_id)
);

-- ---- property_rooms ----
CREATE TABLE IF NOT EXISTS public.property_rooms (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT,
  display_order INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- property_photos ----
CREATE TABLE IF NOT EXISTS public.property_photos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  room_id       UUID REFERENCES public.property_rooms(id) ON DELETE SET NULL,
  url           TEXT NOT NULL,
  caption       TEXT,
  display_order INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- price_periods ----
CREATE TABLE IF NOT EXISTS public.price_periods (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  price_per_night NUMERIC(10,2) NOT NULL,
  period_type     pricing_rule_type NOT NULL,
  start_date      DATE,
  end_date        DATE,
  priority        INT NOT NULL DEFAULT 0,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_periods_property_id ON public.price_periods(property_id);

-- ---- blocked_dates ----
CREATE TABLE IF NOT EXISTS public.blocked_dates (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id  UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  blocked_date DATE NOT NULL,
  reason       TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blocked_dates_property_id ON public.blocked_dates(property_id);

-- ---- bookings ----
CREATE TABLE IF NOT EXISTS public.bookings (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id         UUID NOT NULL REFERENCES public.properties(id) ON DELETE RESTRICT,
  guest_id            UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  owner_id            UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  check_in            DATE NOT NULL,
  check_out           DATE NOT NULL,
  nights              INT NOT NULL,
  total_guests        INT NOT NULL DEFAULT 1,
  subtotal            NUMERIC(10,2) NOT NULL,
  platform_fee        NUMERIC(10,2) NOT NULL DEFAULT 0,
  insurance_amount    NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_amount     NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_price         NUMERIC(10,2) NOT NULL,
  coupon_code         TEXT,
  status              booking_status NOT NULL DEFAULT 'AGUARDANDO_PAGAMENTO',
  insurance_plan      insurance_plan NOT NULL DEFAULT 'NENHUM',
  booking_number      TEXT UNIQUE,
  repasse_liberado    BOOLEAN DEFAULT FALSE,
  repasse_liberado_at TIMESTAMPTZ,
  owner_confirmed     BOOLEAN DEFAULT FALSE,
  cancellation_reason TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bookings_guest_id    ON public.bookings(guest_id);
CREATE INDEX IF NOT EXISTS idx_bookings_owner_id    ON public.bookings(owner_id);
CREATE INDEX IF NOT EXISTS idx_bookings_property_id ON public.bookings(property_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status      ON public.bookings(status);

DROP TRIGGER IF EXISTS set_updated_at_bookings ON public.bookings;
CREATE TRIGGER set_updated_at_bookings BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE OR REPLACE FUNCTION generate_booking_number()
RETURNS TRIGGER AS $$
BEGIN NEW.booking_number = 'LFX-' || UPPER(SUBSTRING(NEW.id::TEXT, 1, 8)); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_booking_number ON public.bookings;
CREATE TRIGGER set_booking_number BEFORE INSERT ON public.bookings FOR EACH ROW EXECUTE FUNCTION generate_booking_number();

-- ---- installments ----
CREATE TABLE IF NOT EXISTS public.installments (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id        UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  number            INT NOT NULL,
  value             NUMERIC(10,2) NOT NULL,
  due_date          DATE NOT NULL,
  status            installment_status NOT NULL DEFAULT 'PENDENTE',
  type              installment_type NOT NULL DEFAULT 'PARCELA',
  asaas_payment_id  TEXT,
  asaas_customer_id TEXT,
  paid_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_installments_booking_id ON public.installments(booking_id);
CREATE INDEX IF NOT EXISTS idx_installments_status     ON public.installments(status);

DROP TRIGGER IF EXISTS set_updated_at_installments ON public.installments;
CREATE TRIGGER set_updated_at_installments BEFORE UPDATE ON public.installments FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE OR REPLACE FUNCTION update_booking_status_on_payment()
RETURNS TRIGGER AS $$
DECLARE
  total_installments INT;
  paid_installments  INT;
BEGIN
  IF NEW.status = 'PAGO' AND OLD.status != 'PAGO' THEN
    SELECT COUNT(*) INTO total_installments FROM public.installments WHERE booking_id = NEW.booking_id;
    SELECT COUNT(*) INTO paid_installments  FROM public.installments WHERE booking_id = NEW.booking_id AND status = 'PAGO';
    IF paid_installments = total_installments THEN
      UPDATE public.bookings SET status = 'PAGO'    WHERE id = NEW.booking_id;
    ELSE
      UPDATE public.bookings SET status = 'PARCIAL' WHERE id = NEW.booking_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_installment_paid ON public.installments;
CREATE TRIGGER on_installment_paid AFTER UPDATE ON public.installments FOR EACH ROW EXECUTE FUNCTION update_booking_status_on_payment();

-- ---- contracts ----
CREATE TABLE IF NOT EXISTS public.contracts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id  UUID NOT NULL UNIQUE REFERENCES public.bookings(id) ON DELETE CASCADE,
  guest_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  owner_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  content     TEXT NOT NULL,
  ip_address  TEXT,
  user_agent  TEXT,
  accepted_at TIMESTAMPTZ,
  version     TEXT NOT NULL DEFAULT '1.0',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_updated_at_contracts ON public.contracts;
CREATE TRIGGER set_updated_at_contracts BEFORE UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ---- conversation_tickets ----
CREATE TABLE IF NOT EXISTS public.conversation_tickets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participants UUID[] NOT NULL,
  subject     TEXT,
  status      TEXT NOT NULL DEFAULT 'ABERTO',
  priority    TEXT NOT NULL DEFAULT 'NORMAL',
  category    TEXT DEFAULT 'Outro',
  created_by  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_updated_at_tickets ON public.conversation_tickets;
CREATE TRIGGER set_updated_at_tickets BEFORE UPDATE ON public.conversation_tickets FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ---- messages ----
CREATE TABLE IF NOT EXISTS public.messages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id  UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  ticket_id   UUID REFERENCES public.conversation_tickets(id) ON DELETE SET NULL,
  sender_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  subject     TEXT,
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_booking_id  ON public.messages(booking_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id   ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON public.messages(receiver_id);

DROP TRIGGER IF EXISTS set_updated_at_messages ON public.messages;
CREATE TRIGGER set_updated_at_messages BEFORE UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ---- reviews ----
CREATE TABLE IF NOT EXISTS public.reviews (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id         UUID NOT NULL UNIQUE REFERENCES public.bookings(id) ON DELETE CASCADE,
  reviewer_id        UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  target_property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
  target_user_id     UUID REFERENCES public.users(id) ON DELETE CASCADE,
  rating             NUMERIC(3,1) NOT NULL CHECK (rating >= 1 AND rating <= 5),
  cleanliness        NUMERIC(3,1),
  communication      NUMERIC(3,1),
  location           NUMERIC(3,1),
  cost_benefit       NUMERIC(3,1),
  comment            TEXT,
  mode               review_mode NOT NULL,
  visible            BOOLEAN NOT NULL DEFAULT FALSE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_property_id ON public.reviews(target_property_id);

DROP TRIGGER IF EXISTS set_updated_at_reviews ON public.reviews;
CREATE TRIGGER set_updated_at_reviews BEFORE UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE OR REPLACE FUNCTION update_property_rating()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.target_property_id IS NOT NULL AND NEW.visible = TRUE THEN
    UPDATE public.properties
    SET
      rating        = (SELECT AVG(rating)  FROM public.reviews WHERE target_property_id = NEW.target_property_id AND visible = TRUE),
      reviews_count = (SELECT COUNT(*)     FROM public.reviews WHERE target_property_id = NEW.target_property_id AND visible = TRUE)
    WHERE id = NEW.target_property_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_review_inserted ON public.reviews;
CREATE TRIGGER on_review_inserted AFTER INSERT OR UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION update_property_rating();

-- ---- notifications ----
CREATE TABLE IF NOT EXISTS public.notifications (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  type       TEXT NOT NULL DEFAULT 'INFO',
  is_read    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);

DROP TRIGGER IF EXISTS set_updated_at_notifications ON public.notifications;
CREATE TRIGGER set_updated_at_notifications BEFORE UPDATE ON public.notifications FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ---- favorites ----
CREATE TABLE IF NOT EXISTS public.favorites (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, property_id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON public.favorites(user_id);

-- ---- coupons ----
CREATE TABLE IF NOT EXISTS public.coupons (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code              TEXT NOT NULL UNIQUE,
  type              coupon_type NOT NULL DEFAULT 'PERCENTUAL',
  value             NUMERIC(10,2) NOT NULL,
  min_booking_value NUMERIC(10,2) NOT NULL DEFAULT 0,
  max_uses          INT NOT NULL DEFAULT 1,
  current_uses      INT NOT NULL DEFAULT 0,
  expires_at        TIMESTAMPTZ,
  active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_updated_at_coupons ON public.coupons;
CREATE TRIGGER set_updated_at_coupons BEFORE UPDATE ON public.coupons FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ---- platform_settings ----
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key        TEXT NOT NULL UNIQUE,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---- cancellation_policies_config ----
CREATE TABLE IF NOT EXISTS public.cancellation_policies_config (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_name TEXT NOT NULL UNIQUE,
  rules       JSONB NOT NULL DEFAULT '[]',
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ---- incidents ----
CREATE TABLE IF NOT EXISTS public.incidents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id   UUID REFERENCES public.users(id) ON DELETE SET NULL,
  property_id   UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  booking_id    UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  reporter_role TEXT NOT NULL,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'ABERTO',
  admin_notes   TEXT,
  photos        JSONB DEFAULT '[]',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_updated_at_incidents ON public.incidents;
CREATE TRIGGER set_updated_at_incidents BEFORE UPDATE ON public.incidents FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ---- incident_messages ----
CREATE TABLE IF NOT EXISTS public.incident_messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id  UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  sender_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  content      TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incident_messages_incident_id ON public.incident_messages(incident_id);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.users                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amenities_catalog        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_amenities       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_rooms           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_photos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_periods            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_dates            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installments             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_tickets     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cancellation_policies_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_messages        ENABLE ROW LEVEL SECURITY;

-- ---- users ----
DROP POLICY IF EXISTS users_select_own ON public.users;
DROP POLICY IF EXISTS users_update_own ON public.users;
DROP POLICY IF EXISTS users_insert_own ON public.users;
-- Owners can see their guests; guests can see their hosts; admins see all
CREATE POLICY users_select_own ON public.users FOR SELECT USING (
  id = auth.uid()
  OR is_admin()
  OR EXISTS (
    SELECT 1 FROM public.bookings
    WHERE (owner_id = auth.uid() AND guest_id = public.users.id)
       OR (guest_id = auth.uid() AND owner_id = public.users.id)
  )
);
CREATE POLICY users_update_own ON public.users FOR UPDATE USING (id = auth.uid() OR is_admin());
CREATE POLICY users_insert_own ON public.users FOR INSERT WITH CHECK (id = auth.uid());

-- ---- properties ----
DROP POLICY IF EXISTS properties_select_active ON public.properties;
DROP POLICY IF EXISTS properties_insert_owner  ON public.properties;
DROP POLICY IF EXISTS properties_update_owner  ON public.properties;
DROP POLICY IF EXISTS properties_delete_owner  ON public.properties;
CREATE POLICY properties_select_active ON public.properties FOR SELECT USING (status = 'ATIVO' OR owner_id = auth.uid() OR is_admin());
CREATE POLICY properties_insert_owner  ON public.properties FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY properties_update_owner  ON public.properties FOR UPDATE USING (owner_id = auth.uid() OR is_admin());
CREATE POLICY properties_delete_owner  ON public.properties FOR DELETE USING (owner_id = auth.uid() OR is_admin());

-- ---- amenities_catalog ----
DROP POLICY IF EXISTS amenities_catalog_select ON public.amenities_catalog;
DROP POLICY IF EXISTS amenities_catalog_manage ON public.amenities_catalog;
CREATE POLICY amenities_catalog_select ON public.amenities_catalog FOR SELECT USING (TRUE);
CREATE POLICY amenities_catalog_manage ON public.amenities_catalog FOR ALL USING (is_admin());

-- ---- property_amenities ----
DROP POLICY IF EXISTS property_amenities_select ON public.property_amenities;
DROP POLICY IF EXISTS property_amenities_insert ON public.property_amenities;
DROP POLICY IF EXISTS property_amenities_delete ON public.property_amenities;
CREATE POLICY property_amenities_select ON public.property_amenities FOR SELECT USING (
  property_id IN (SELECT id FROM public.properties WHERE status = 'ATIVO' OR owner_id = auth.uid()) OR is_admin()
);
CREATE POLICY property_amenities_insert ON public.property_amenities FOR INSERT WITH CHECK (
  property_id IN (SELECT id FROM public.properties WHERE owner_id = auth.uid()) OR is_admin()
);
CREATE POLICY property_amenities_delete ON public.property_amenities FOR DELETE USING (
  property_id IN (SELECT id FROM public.properties WHERE owner_id = auth.uid()) OR is_admin()
);

-- ---- property_rooms ----
DROP POLICY IF EXISTS property_rooms_select ON public.property_rooms;
DROP POLICY IF EXISTS property_rooms_insert ON public.property_rooms;
DROP POLICY IF EXISTS property_rooms_delete ON public.property_rooms;
CREATE POLICY property_rooms_select ON public.property_rooms FOR SELECT USING (
  property_id IN (SELECT id FROM public.properties WHERE status = 'ATIVO' OR owner_id = auth.uid()) OR is_admin()
);
CREATE POLICY property_rooms_insert ON public.property_rooms FOR INSERT WITH CHECK (
  property_id IN (SELECT id FROM public.properties WHERE owner_id = auth.uid()) OR is_admin()
);
CREATE POLICY property_rooms_delete ON public.property_rooms FOR DELETE USING (
  property_id IN (SELECT id FROM public.properties WHERE owner_id = auth.uid()) OR is_admin()
);

-- ---- property_photos ----
DROP POLICY IF EXISTS property_photos_select ON public.property_photos;
DROP POLICY IF EXISTS property_photos_insert ON public.property_photos;
DROP POLICY IF EXISTS property_photos_delete ON public.property_photos;
CREATE POLICY property_photos_select ON public.property_photos FOR SELECT USING (
  property_id IN (SELECT id FROM public.properties WHERE status = 'ATIVO' OR owner_id = auth.uid()) OR is_admin()
);
CREATE POLICY property_photos_insert ON public.property_photos FOR INSERT WITH CHECK (
  property_id IN (SELECT id FROM public.properties WHERE owner_id = auth.uid()) OR is_admin()
);
CREATE POLICY property_photos_delete ON public.property_photos FOR DELETE USING (
  property_id IN (SELECT id FROM public.properties WHERE owner_id = auth.uid()) OR is_admin()
);

-- ---- price_periods ----
DROP POLICY IF EXISTS price_periods_select ON public.price_periods;
DROP POLICY IF EXISTS price_periods_insert ON public.price_periods;
DROP POLICY IF EXISTS price_periods_update ON public.price_periods;
DROP POLICY IF EXISTS price_periods_delete ON public.price_periods;
CREATE POLICY price_periods_select ON public.price_periods FOR SELECT USING (
  property_id IN (SELECT id FROM public.properties WHERE status = 'ATIVO' OR owner_id = auth.uid()) OR is_admin()
);
CREATE POLICY price_periods_insert ON public.price_periods FOR INSERT WITH CHECK (
  property_id IN (SELECT id FROM public.properties WHERE owner_id = auth.uid()) OR is_admin()
);
CREATE POLICY price_periods_update ON public.price_periods FOR UPDATE USING (
  property_id IN (SELECT id FROM public.properties WHERE owner_id = auth.uid()) OR is_admin()
);
CREATE POLICY price_periods_delete ON public.price_periods FOR DELETE USING (
  property_id IN (SELECT id FROM public.properties WHERE owner_id = auth.uid()) OR is_admin()
);

-- ---- blocked_dates ----
DROP POLICY IF EXISTS blocked_dates_select ON public.blocked_dates;
DROP POLICY IF EXISTS blocked_dates_insert ON public.blocked_dates;
DROP POLICY IF EXISTS blocked_dates_delete ON public.blocked_dates;
CREATE POLICY blocked_dates_select ON public.blocked_dates FOR SELECT USING (TRUE);
CREATE POLICY blocked_dates_insert ON public.blocked_dates FOR INSERT WITH CHECK (
  property_id IN (SELECT id FROM public.properties WHERE owner_id = auth.uid()) OR is_admin()
);
CREATE POLICY blocked_dates_delete ON public.blocked_dates FOR DELETE USING (
  property_id IN (SELECT id FROM public.properties WHERE owner_id = auth.uid()) OR is_admin()
);

-- ---- bookings ----
DROP POLICY IF EXISTS bookings_select ON public.bookings;
DROP POLICY IF EXISTS bookings_insert ON public.bookings;
DROP POLICY IF EXISTS bookings_update ON public.bookings;
CREATE POLICY bookings_select ON public.bookings FOR SELECT USING (guest_id = auth.uid() OR owner_id = auth.uid() OR is_admin());
CREATE POLICY bookings_insert ON public.bookings FOR INSERT WITH CHECK (guest_id = auth.uid());
CREATE POLICY bookings_update ON public.bookings FOR UPDATE USING (guest_id = auth.uid() OR owner_id = auth.uid() OR is_admin());

-- ---- installments ----
DROP POLICY IF EXISTS installments_select ON public.installments;
DROP POLICY IF EXISTS installments_insert ON public.installments;
DROP POLICY IF EXISTS installments_update ON public.installments;
CREATE POLICY installments_select ON public.installments FOR SELECT USING (
  booking_id IN (SELECT id FROM public.bookings WHERE guest_id = auth.uid() OR owner_id = auth.uid()) OR is_admin()
);
CREATE POLICY installments_insert ON public.installments FOR INSERT WITH CHECK (
  booking_id IN (SELECT id FROM public.bookings WHERE guest_id = auth.uid()) OR is_admin()
);
CREATE POLICY installments_update ON public.installments FOR UPDATE USING (is_admin());

-- ---- contracts ----
DROP POLICY IF EXISTS contracts_select ON public.contracts;
DROP POLICY IF EXISTS contracts_insert ON public.contracts;
CREATE POLICY contracts_select ON public.contracts FOR SELECT USING (guest_id = auth.uid() OR owner_id = auth.uid() OR is_admin());
CREATE POLICY contracts_insert ON public.contracts FOR INSERT WITH CHECK (guest_id = auth.uid());

-- ---- conversation_tickets ----
DROP POLICY IF EXISTS tickets_select ON public.conversation_tickets;
DROP POLICY IF EXISTS tickets_insert ON public.conversation_tickets;
DROP POLICY IF EXISTS tickets_update ON public.conversation_tickets;
CREATE POLICY tickets_select ON public.conversation_tickets FOR SELECT USING (auth.uid() = ANY(participants) OR is_admin());
CREATE POLICY tickets_insert ON public.conversation_tickets FOR INSERT WITH CHECK (auth.uid() = ANY(participants) OR is_admin());
CREATE POLICY tickets_update ON public.conversation_tickets FOR UPDATE USING (auth.uid() = ANY(participants) OR is_admin());

-- ---- messages ----
DROP POLICY IF EXISTS messages_select ON public.messages;
DROP POLICY IF EXISTS messages_insert ON public.messages;
DROP POLICY IF EXISTS messages_update ON public.messages;
CREATE POLICY messages_select ON public.messages FOR SELECT USING (sender_id = auth.uid() OR receiver_id = auth.uid() OR is_admin());
CREATE POLICY messages_insert ON public.messages FOR INSERT WITH CHECK (sender_id = auth.uid());
CREATE POLICY messages_update ON public.messages FOR UPDATE USING (sender_id = auth.uid() OR receiver_id = auth.uid());

-- ---- reviews ----
DROP POLICY IF EXISTS reviews_select ON public.reviews;
DROP POLICY IF EXISTS reviews_insert ON public.reviews;
DROP POLICY IF EXISTS reviews_update ON public.reviews;
CREATE POLICY reviews_select ON public.reviews FOR SELECT USING (visible = TRUE OR reviewer_id = auth.uid() OR is_admin());
CREATE POLICY reviews_insert ON public.reviews FOR INSERT WITH CHECK (reviewer_id = auth.uid());
CREATE POLICY reviews_update ON public.reviews FOR UPDATE USING (reviewer_id = auth.uid() OR is_admin());

-- ---- notifications ----
DROP POLICY IF EXISTS notifications_select ON public.notifications;
DROP POLICY IF EXISTS notifications_insert ON public.notifications;
DROP POLICY IF EXISTS notifications_update ON public.notifications;
CREATE POLICY notifications_select ON public.notifications FOR SELECT USING (user_id = auth.uid() OR is_admin());
CREATE POLICY notifications_insert ON public.notifications FOR INSERT WITH CHECK (is_admin() OR user_id = auth.uid());
CREATE POLICY notifications_update ON public.notifications FOR UPDATE USING (user_id = auth.uid());

-- ---- favorites ----
DROP POLICY IF EXISTS favorites_select ON public.favorites;
DROP POLICY IF EXISTS favorites_insert ON public.favorites;
DROP POLICY IF EXISTS favorites_delete ON public.favorites;
CREATE POLICY favorites_select ON public.favorites FOR SELECT USING (user_id = auth.uid());
CREATE POLICY favorites_insert ON public.favorites FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY favorites_delete ON public.favorites FOR DELETE USING (user_id = auth.uid());

-- ---- coupons ----
DROP POLICY IF EXISTS coupons_select ON public.coupons;
DROP POLICY IF EXISTS coupons_insert ON public.coupons;
DROP POLICY IF EXISTS coupons_update ON public.coupons;
CREATE POLICY coupons_select ON public.coupons FOR SELECT USING (active = TRUE OR is_admin());
CREATE POLICY coupons_insert ON public.coupons FOR INSERT WITH CHECK (is_admin());
CREATE POLICY coupons_update ON public.coupons FOR UPDATE USING (is_admin());

-- ---- platform_settings ----
DROP POLICY IF EXISTS platform_settings_select ON public.platform_settings;
DROP POLICY IF EXISTS platform_settings_update ON public.platform_settings;
CREATE POLICY platform_settings_select ON public.platform_settings FOR SELECT USING (TRUE);
CREATE POLICY platform_settings_update ON public.platform_settings FOR UPDATE USING (is_admin());

-- ---- cancellation_policies_config ----
DROP POLICY IF EXISTS cancellation_config_select ON public.cancellation_policies_config;
DROP POLICY IF EXISTS cancellation_config_manage ON public.cancellation_policies_config;
CREATE POLICY cancellation_config_select ON public.cancellation_policies_config FOR SELECT USING (TRUE);
CREATE POLICY cancellation_config_manage ON public.cancellation_policies_config FOR ALL USING (is_admin());

-- ---- incidents ----
DROP POLICY IF EXISTS incidents_select ON public.incidents;
DROP POLICY IF EXISTS incidents_insert ON public.incidents;
DROP POLICY IF EXISTS incidents_update ON public.incidents;
CREATE POLICY incidents_select ON public.incidents FOR SELECT USING (reporter_id = auth.uid() OR is_admin());
CREATE POLICY incidents_insert ON public.incidents FOR INSERT WITH CHECK (reporter_id = auth.uid());
CREATE POLICY incidents_update ON public.incidents FOR UPDATE USING (reporter_id = auth.uid() OR is_admin());

-- ---- incident_messages ----
DROP POLICY IF EXISTS incident_messages_select ON public.incident_messages;
DROP POLICY IF EXISTS incident_messages_insert ON public.incident_messages;
CREATE POLICY incident_messages_select ON public.incident_messages FOR SELECT USING (
  incident_id IN (SELECT id FROM public.incidents WHERE reporter_id = auth.uid()) OR is_admin()
);
CREATE POLICY incident_messages_insert ON public.incident_messages FOR INSERT WITH CHECK (sender_id = auth.uid() OR is_admin());

-- ============================================================
-- GRANTS
-- ============================================================
GRANT SELECT ON public.properties             TO anon;
GRANT SELECT ON public.reviews                TO anon;
GRANT SELECT ON public.amenities_catalog      TO anon;

GRANT SELECT, INSERT, UPDATE                  ON public.users                        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE          ON public.properties                   TO authenticated;
GRANT SELECT, INSERT, DELETE                  ON public.property_amenities           TO authenticated;
GRANT SELECT, INSERT, DELETE                  ON public.property_rooms               TO authenticated;
GRANT SELECT, INSERT, DELETE                  ON public.property_photos              TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE          ON public.price_periods                TO authenticated;
GRANT SELECT, INSERT, DELETE                  ON public.blocked_dates                TO authenticated;
GRANT SELECT, INSERT, UPDATE                  ON public.bookings                     TO authenticated;
GRANT SELECT, INSERT, UPDATE                  ON public.installments                 TO authenticated;
GRANT SELECT, INSERT                          ON public.contracts                    TO authenticated;
GRANT SELECT, INSERT, UPDATE                  ON public.conversation_tickets         TO authenticated;
GRANT SELECT, INSERT, UPDATE                  ON public.messages                     TO authenticated;
GRANT SELECT, INSERT, UPDATE                  ON public.reviews                      TO authenticated;
GRANT SELECT, INSERT, UPDATE                  ON public.notifications                TO authenticated;
GRANT SELECT, INSERT, DELETE                  ON public.favorites                    TO authenticated;
GRANT SELECT                                  ON public.coupons                      TO authenticated;
GRANT SELECT                                  ON public.amenities_catalog            TO authenticated;
GRANT SELECT                                  ON public.platform_settings            TO authenticated;
GRANT SELECT                                  ON public.cancellation_policies_config TO authenticated;
GRANT SELECT, INSERT                          ON public.incidents                    TO authenticated;
GRANT SELECT, INSERT                          ON public.incident_messages            TO authenticated;

-- ============================================================
-- TRIGGER: criar user em public.users ao registrar no auth
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'GUEST')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user failed: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- REALTIME
-- ============================================================
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.installments;          EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;         EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;              EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;              EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_tickets;  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.incidents;             EXCEPTION WHEN duplicate_object THEN NULL; END $$;
