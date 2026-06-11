-- Migration: extension_requests table
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.extension_requests (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id       UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  guest_id         UUID NOT NULL REFERENCES public.users(id)    ON DELETE CASCADE,
  owner_id         UUID NOT NULL REFERENCES public.users(id)    ON DELETE CASCADE,
  current_checkout DATE NOT NULL,
  new_checkout     DATE NOT NULL,
  extra_nights     INT  NOT NULL,
  extra_cost       NUMERIC(10,2) NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','ACCEPTED','REJECTED')),
  reject_reason    TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ext_req_booking  ON public.extension_requests(booking_id);
CREATE INDEX IF NOT EXISTS idx_ext_req_owner    ON public.extension_requests(owner_id);
CREATE INDEX IF NOT EXISTS idx_ext_req_guest    ON public.extension_requests(guest_id);
CREATE INDEX IF NOT EXISTS idx_ext_req_status   ON public.extension_requests(status);

CREATE OR REPLACE TRIGGER set_updated_at_ext_req
  BEFORE UPDATE ON public.extension_requests
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

ALTER TABLE public.extension_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ext_req_select ON public.extension_requests;
DROP POLICY IF EXISTS ext_req_insert ON public.extension_requests;
DROP POLICY IF EXISTS ext_req_update ON public.extension_requests;

CREATE POLICY ext_req_select ON public.extension_requests
  FOR SELECT USING (guest_id = auth.uid() OR owner_id = auth.uid() OR is_admin());

CREATE POLICY ext_req_insert ON public.extension_requests
  FOR INSERT WITH CHECK (guest_id = auth.uid());

CREATE POLICY ext_req_update ON public.extension_requests
  FOR UPDATE USING (owner_id = auth.uid() OR is_admin());

GRANT SELECT, INSERT ON public.extension_requests TO authenticated;
GRANT UPDATE (status, reject_reason, updated_at) ON public.extension_requests TO authenticated;
