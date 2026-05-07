-- ============================================================
-- LOCAFLIX — Schema Supabase
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE user_role AS ENUM ('GUEST', 'OWNER', 'ADMIN');
CREATE TYPE kyc_status AS ENUM ('PENDENTE', 'APROVADO', 'REPROVADO', 'INCOMPLETO');
CREATE TYPE property_status AS ENUM ('PENDENTE', 'ATIVO', 'INATIVO', 'REPROVADO');
CREATE TYPE property_plan AS ENUM ('STANDARD', 'DESTAQUE');
CREATE TYPE property_type AS ENUM ('CASA', 'APARTAMENTO', 'CHALÉ', 'POUSADA', 'SÍTIO', 'COBERTURA', 'LOFT', 'STUDIO');
CREATE TYPE cancellation_policy AS ENUM ('FLEXIVEL', 'MODERADO', 'FIRME');
CREATE TYPE booking_status AS ENUM ('AGUARDANDO_PAGAMENTO', 'PARCIAL', 'PAGO', 'CONCLUIDA', 'CANCELADA');
CREATE TYPE installment_status AS ENUM ('PENDENTE', 'PAGO', 'ATRASADO', 'CANCELADO');
CREATE TYPE installment_type AS ENUM ('ENTRADA', 'PARCELA');
CREATE TYPE insurance_plan AS ENUM ('NENHUM', 'BASICO', 'PADRAO', 'PREMIUM');
CREATE TYPE review_mode AS ENUM ('OWNER_RATES_GUEST', 'GUEST_RATES_PROPERTY');
CREATE TYPE coupon_type AS ENUM ('PERCENTUAL', 'FIXO');
CREATE TYPE pricing_rule_type AS ENUM ('WEEKEND', 'HOLIDAY', 'SPECIAL', 'LOW_SEASON', 'HIGH_SEASON');
CREATE TYPE ownership_type AS ENUM ('PROPRIO', 'TERCEIRO');
CREATE TYPE kinship_type AS ENUM ('PAI', 'MAE', 'ESPOSO', 'ESPOSA', 'FILHO', 'FILHA', 'OUTRO');

-- ============================================================
-- FUNÇÃO updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNÇÃO is_admin()
-- ============================================================
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'ADMIN'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- TABELA: users
-- ============================================================
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
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_updated_at_users
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ============================================================
-- TABELA: properties
-- ============================================================
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

CREATE INDEX idx_properties_status   ON public.properties(status);
CREATE INDEX idx_properties_owner_id ON public.properties(owner_id);
CREATE INDEX idx_properties_city     ON public.properties(city);
CREATE INDEX idx_properties_state    ON public.properties(state);

CREATE TRIGGER set_updated_at_properties
  BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ============================================================
-- TABELA: bookings
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bookings (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id           UUID NOT NULL REFERENCES public.properties(id) ON DELETE RESTRICT,
  guest_id              UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  owner_id              UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  check_in              DATE NOT NULL,
  check_out             DATE NOT NULL,
  nights                INT NOT NULL,
  total_guests          INT NOT NULL DEFAULT 1,
  subtotal              NUMERIC(10,2) NOT NULL,
  platform_fee          NUMERIC(10,2) NOT NULL DEFAULT 0,
  insurance_amount      NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_amount       NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_price           NUMERIC(10,2) NOT NULL,
  coupon_code           TEXT,
  status                booking_status NOT NULL DEFAULT 'AGUARDANDO_PAGAMENTO',
  insurance_plan        insurance_plan NOT NULL DEFAULT 'NENHUM',
  booking_number        TEXT UNIQUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bookings_guest_id    ON public.bookings(guest_id);
CREATE INDEX idx_bookings_owner_id    ON public.bookings(owner_id);
CREATE INDEX idx_bookings_property_id ON public.bookings(property_id);
CREATE INDEX idx_bookings_status      ON public.bookings(status);

CREATE TRIGGER set_updated_at_bookings
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Gera booking_number automaticamente
CREATE OR REPLACE FUNCTION generate_booking_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.booking_number = 'LFX-' || UPPER(SUBSTRING(NEW.id::TEXT, 1, 8));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_booking_number
  BEFORE INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION generate_booking_number();

-- ============================================================
-- TABELA: installments
-- ============================================================
CREATE TABLE IF NOT EXISTS public.installments (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id         UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  number             INT NOT NULL,
  value              NUMERIC(10,2) NOT NULL,
  due_date           DATE NOT NULL,
  status             installment_status NOT NULL DEFAULT 'PENDENTE',
  type               installment_type NOT NULL DEFAULT 'PARCELA',
  asaas_payment_id   TEXT,
  asaas_customer_id  TEXT,
  paid_at            TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_installments_booking_id ON public.installments(booking_id);
CREATE INDEX idx_installments_status     ON public.installments(status);

CREATE TRIGGER set_updated_at_installments
  BEFORE UPDATE ON public.installments
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Trigger: atualiza status da booking quando todas as installments são PAGO
CREATE OR REPLACE FUNCTION update_booking_status_on_payment()
RETURNS TRIGGER AS $$
DECLARE
  total_installments INT;
  paid_installments  INT;
  partial_count      INT;
BEGIN
  IF NEW.status = 'PAGO' AND OLD.status != 'PAGO' THEN
    SELECT COUNT(*) INTO total_installments
    FROM public.installments WHERE booking_id = NEW.booking_id;

    SELECT COUNT(*) INTO paid_installments
    FROM public.installments WHERE booking_id = NEW.booking_id AND status = 'PAGO';

    SELECT COUNT(*) INTO partial_count
    FROM public.installments WHERE booking_id = NEW.booking_id AND status = 'PAGO';

    IF paid_installments = total_installments THEN
      UPDATE public.bookings SET status = 'PAGO' WHERE id = NEW.booking_id;
    ELSIF partial_count > 0 THEN
      UPDATE public.bookings SET status = 'PARCIAL' WHERE id = NEW.booking_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_installment_paid
  AFTER UPDATE ON public.installments
  FOR EACH ROW EXECUTE FUNCTION update_booking_status_on_payment();

-- ============================================================
-- TABELA: contracts
-- ============================================================
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

CREATE TRIGGER set_updated_at_contracts
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ============================================================
-- TABELA: messages
-- ============================================================
CREATE TABLE IF NOT EXISTS public.messages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id  UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  sender_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_booking_id ON public.messages(booking_id);
CREATE INDEX idx_messages_sender_id  ON public.messages(sender_id);

CREATE TRIGGER set_updated_at_messages
  BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ============================================================
-- TABELA: reviews
-- ============================================================
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
  visible            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reviews_property_id ON public.reviews(target_property_id);

CREATE TRIGGER set_updated_at_reviews
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Trigger: atualiza rating e reviews_count da property
CREATE OR REPLACE FUNCTION update_property_rating()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.target_property_id IS NOT NULL AND NEW.visible = TRUE THEN
    UPDATE public.properties
    SET
      rating = (
        SELECT AVG(rating) FROM public.reviews
        WHERE target_property_id = NEW.target_property_id AND visible = TRUE
      ),
      reviews_count = (
        SELECT COUNT(*) FROM public.reviews
        WHERE target_property_id = NEW.target_property_id AND visible = TRUE
      )
    WHERE id = NEW.target_property_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_review_inserted
  AFTER INSERT OR UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION update_property_rating();

-- ============================================================
-- TABELA: notifications
-- ============================================================
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

CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);

CREATE TRIGGER set_updated_at_notifications
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ============================================================
-- TABELA: favorites
-- ============================================================
CREATE TABLE IF NOT EXISTS public.favorites (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, property_id)
);

CREATE INDEX idx_favorites_user_id ON public.favorites(user_id);

-- ============================================================
-- TABELA: coupons
-- ============================================================
CREATE TABLE IF NOT EXISTS public.coupons (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code               TEXT NOT NULL UNIQUE,
  type               coupon_type NOT NULL DEFAULT 'PERCENTUAL',
  value              NUMERIC(10,2) NOT NULL,
  min_booking_value  NUMERIC(10,2) NOT NULL DEFAULT 0,
  max_uses           INT NOT NULL DEFAULT 1,
  current_uses       INT NOT NULL DEFAULT 0,
  expires_at         TIMESTAMPTZ,
  active             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_updated_at_coupons
  BEFORE UPDATE ON public.coupons
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ============================================================
-- TABELA: property_pricing_rules
-- ============================================================
CREATE TABLE IF NOT EXISTS public.property_pricing_rules (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id    UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  rule_type      pricing_rule_type NOT NULL,
  multiplier     NUMERIC(4,2) NOT NULL DEFAULT 1.0,
  specific_dates DATE[],
  start_date     DATE,
  end_date       DATE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pricing_rules_property_id ON public.property_pricing_rules(property_id);

CREATE TRIGGER set_updated_at_pricing_rules
  BEFORE UPDATE ON public.property_pricing_rules
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ============================================================
-- TABELA: availability_blocks
-- ============================================================
CREATE TABLE IF NOT EXISTS public.availability_blocks (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  reason      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_availability_blocks_property_id ON public.availability_blocks(property_id);

CREATE TRIGGER set_updated_at_availability_blocks
  BEFORE UPDATE ON public.availability_blocks
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================
ALTER TABLE public.users                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_blocks   ENABLE ROW LEVEL SECURITY;

-- ---- users ----
CREATE POLICY users_select_own   ON public.users FOR SELECT USING (id = auth.uid() OR is_admin());
CREATE POLICY users_update_own   ON public.users FOR UPDATE USING (id = auth.uid() OR is_admin());
CREATE POLICY users_insert_own   ON public.users FOR INSERT WITH CHECK (id = auth.uid());

-- ---- properties ----
CREATE POLICY properties_select_active ON public.properties
  FOR SELECT USING (status = 'ATIVO' OR owner_id = auth.uid() OR is_admin());
CREATE POLICY properties_insert_owner  ON public.properties
  FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY properties_update_owner  ON public.properties
  FOR UPDATE USING (owner_id = auth.uid() OR is_admin());
CREATE POLICY properties_delete_owner  ON public.properties
  FOR DELETE USING (owner_id = auth.uid() OR is_admin());

-- ---- bookings ----
CREATE POLICY bookings_select ON public.bookings
  FOR SELECT USING (guest_id = auth.uid() OR owner_id = auth.uid() OR is_admin());
CREATE POLICY bookings_insert ON public.bookings
  FOR INSERT WITH CHECK (guest_id = auth.uid());
CREATE POLICY bookings_update ON public.bookings
  FOR UPDATE USING (guest_id = auth.uid() OR owner_id = auth.uid() OR is_admin());

-- ---- installments ----
CREATE POLICY installments_select ON public.installments
  FOR SELECT USING (
    booking_id IN (
      SELECT id FROM public.bookings
      WHERE guest_id = auth.uid() OR owner_id = auth.uid()
    ) OR is_admin()
  );
CREATE POLICY installments_insert ON public.installments
  FOR INSERT WITH CHECK (
    booking_id IN (SELECT id FROM public.bookings WHERE guest_id = auth.uid()) OR is_admin()
  );
CREATE POLICY installments_update ON public.installments
  FOR UPDATE USING (is_admin());

-- ---- contracts ----
CREATE POLICY contracts_select ON public.contracts
  FOR SELECT USING (guest_id = auth.uid() OR owner_id = auth.uid() OR is_admin());
CREATE POLICY contracts_insert ON public.contracts
  FOR INSERT WITH CHECK (guest_id = auth.uid());

-- ---- messages ----
CREATE POLICY messages_select ON public.messages
  FOR SELECT USING (sender_id = auth.uid() OR receiver_id = auth.uid() OR is_admin());
CREATE POLICY messages_insert ON public.messages
  FOR INSERT WITH CHECK (sender_id = auth.uid());
CREATE POLICY messages_update ON public.messages
  FOR UPDATE USING (sender_id = auth.uid() OR receiver_id = auth.uid());

-- ---- reviews ----
CREATE POLICY reviews_select ON public.reviews
  FOR SELECT USING (visible = TRUE OR reviewer_id = auth.uid() OR is_admin());
CREATE POLICY reviews_insert ON public.reviews
  FOR INSERT WITH CHECK (reviewer_id = auth.uid());
CREATE POLICY reviews_update ON public.reviews
  FOR UPDATE USING (reviewer_id = auth.uid() OR is_admin());

-- ---- notifications ----
CREATE POLICY notifications_select ON public.notifications
  FOR SELECT USING (user_id = auth.uid() OR is_admin());
CREATE POLICY notifications_insert ON public.notifications
  FOR INSERT WITH CHECK (is_admin() OR user_id = auth.uid());
CREATE POLICY notifications_update ON public.notifications
  FOR UPDATE USING (user_id = auth.uid());

-- ---- favorites ----
CREATE POLICY favorites_select ON public.favorites
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY favorites_insert ON public.favorites
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY favorites_delete ON public.favorites
  FOR DELETE USING (user_id = auth.uid());

-- ---- coupons ----
CREATE POLICY coupons_select ON public.coupons
  FOR SELECT USING (active = TRUE OR is_admin());
CREATE POLICY coupons_insert ON public.coupons
  FOR INSERT WITH CHECK (is_admin());
CREATE POLICY coupons_update ON public.coupons
  FOR UPDATE USING (is_admin());

-- ---- property_pricing_rules ----
CREATE POLICY pricing_rules_select ON public.property_pricing_rules
  FOR SELECT USING (
    property_id IN (SELECT id FROM public.properties WHERE status = 'ATIVO')
    OR property_id IN (SELECT id FROM public.properties WHERE owner_id = auth.uid())
    OR is_admin()
  );
CREATE POLICY pricing_rules_insert ON public.property_pricing_rules
  FOR INSERT WITH CHECK (
    property_id IN (SELECT id FROM public.properties WHERE owner_id = auth.uid()) OR is_admin()
  );
CREATE POLICY pricing_rules_update ON public.property_pricing_rules
  FOR UPDATE USING (
    property_id IN (SELECT id FROM public.properties WHERE owner_id = auth.uid()) OR is_admin()
  );
CREATE POLICY pricing_rules_delete ON public.property_pricing_rules
  FOR DELETE USING (
    property_id IN (SELECT id FROM public.properties WHERE owner_id = auth.uid()) OR is_admin()
  );

-- ---- availability_blocks ----
CREATE POLICY availability_blocks_select ON public.availability_blocks
  FOR SELECT USING (
    property_id IN (SELECT id FROM public.properties WHERE status = 'ATIVO')
    OR property_id IN (SELECT id FROM public.properties WHERE owner_id = auth.uid())
    OR is_admin()
  );
CREATE POLICY availability_blocks_insert ON public.availability_blocks
  FOR INSERT WITH CHECK (
    property_id IN (SELECT id FROM public.properties WHERE owner_id = auth.uid()) OR is_admin()
  );
CREATE POLICY availability_blocks_update ON public.availability_blocks
  FOR UPDATE USING (
    property_id IN (SELECT id FROM public.properties WHERE owner_id = auth.uid()) OR is_admin()
  );
CREATE POLICY availability_blocks_delete ON public.availability_blocks
  FOR DELETE USING (
    property_id IN (SELECT id FROM public.properties WHERE owner_id = auth.uid()) OR is_admin()
  );

-- ============================================================
-- GRANTS
-- ============================================================
GRANT SELECT ON public.properties TO anon;
GRANT SELECT ON public.reviews    TO anon;

GRANT SELECT, INSERT, UPDATE ON public.users                  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.properties     TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.bookings               TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.installments           TO authenticated;
GRANT SELECT, INSERT ON public.contracts                      TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.messages               TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.reviews                TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.notifications          TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.favorites              TO authenticated;
GRANT SELECT ON public.coupons                                TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_pricing_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.availability_blocks    TO authenticated;

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
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- REALTIME
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.installments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
