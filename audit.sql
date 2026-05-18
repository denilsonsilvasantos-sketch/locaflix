-- ================================================================
-- LOCAFLIX — SCRIPT DE AUDITORIA DO BANCO DE DADOS
-- Gerado em: 2026-05-17
-- Propósito : Auditoria read-only. Não altera nada.
--             Execute no Supabase SQL Editor (cada bloco separado).
-- ================================================================


-- ================================================================
-- SEÇÃO 1 — EXISTÊNCIA DAS TABELAS
-- Verifica quais tabelas esperadas existem no schema public.
-- ================================================================

SELECT
  expected.tablename                                          AS tabela,
  CASE WHEN pt.tablename IS NOT NULL THEN '✓ existe' ELSE '✗ AUSENTE' END AS status
FROM (
  VALUES
    ('users'),
    ('properties'),
    ('bookings'),
    ('installments'),
    ('contracts'),
    ('messages'),
    ('reviews'),
    ('notifications'),
    ('price_periods'),
    ('property_rooms'),
    ('amenities_catalog'),
    ('property_amenities'),
    ('property_photos'),
    ('favorites'),
    ('blocked_dates'),
    ('platform_settings'),
    ('cancellation_policies_config'),
    ('conversation_tickets'),
    ('incident_messages'),
    ('incidents'),
    -- tabelas definidas nos tipos TS mas não encontradas no grep do código:
    ('coupons'),
    ('property_pricing_rules'),
    ('availability_blocks')
) AS expected(tablename)
LEFT JOIN pg_tables pt
  ON pt.schemaname = 'public' AND pt.tablename = expected.tablename
ORDER BY status DESC, expected.tablename;


-- ================================================================
-- SEÇÃO 2 — EXISTÊNCIA DAS COLUNAS POR TABELA
-- Para cada tabela, lista as colunas esperadas e se existem.
-- ================================================================

-- 2.1 users (interface UserProfile)
SELECT column_name, data_type,
  CASE WHEN column_name IN (
    'id','email','name','role','kyc_status','cpf','birth_date','phone',
    'address','number','complement','neighborhood','city','state','cep',
    'document_url','address_proof_url','avatar_url',
    'actual_owner_name','actual_owner_cpf','actual_owner_document_url',
    'ownership_type','kinship_type','kinship_document_url',
    'tour_completed','cookie_accepted','terms_accepted_at',
    'created_at','updated_at',
    'pix_key','bank_name','bank_agency','bank_account','bank_account_type'
  ) THEN '✓ esperada' ELSE '? extra' END AS auditoria
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'users'
ORDER BY ordinal_position;

-- colunas esperadas que NÃO existem na tabela users:
SELECT col AS coluna_esperada, 'users' AS tabela, '✗ AUSENTE' AS status
FROM unnest(ARRAY[
  'id','email','name','role','kyc_status','cpf','birth_date','phone',
  'address','number','complement','neighborhood','city','state','cep',
  'document_url','address_proof_url','avatar_url',
  'actual_owner_name','actual_owner_cpf','actual_owner_document_url',
  'ownership_type','kinship_type','kinship_document_url',
  'tour_completed','cookie_accepted','terms_accepted_at',
  'created_at','updated_at',
  'pix_key','bank_name','bank_agency','bank_account','bank_account_type'
]) AS col
WHERE col NOT IN (
  SELECT column_name FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'users'
);


-- 2.2 properties (interface Property)
SELECT column_name, data_type,
  CASE WHEN column_name IN (
    'id','owner_id','name','description','type','status','plan',
    'city','state','neighborhood','address','cep','number','complement',
    'country','latitude','longitude','price_per_night','min_price',
    'bedrooms','bathrooms','max_guests','amenities','photos',
    'cancellation_policy','rating','reviews_count','created_at','updated_at'
  ) THEN '✓ esperada' ELSE '? extra' END AS auditoria
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'properties'
ORDER BY ordinal_position;

SELECT col AS coluna_esperada, 'properties' AS tabela, '✗ AUSENTE' AS status
FROM unnest(ARRAY[
  'id','owner_id','name','description','type','status','plan',
  'city','state','neighborhood','address','cep','number','complement',
  'country','latitude','longitude','price_per_night','min_price',
  'bedrooms','bathrooms','max_guests','amenities','photos',
  'cancellation_policy','rating','reviews_count','created_at','updated_at'
]) AS col
WHERE col NOT IN (
  SELECT column_name FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'properties'
);


-- 2.3 bookings (interface Booking)
SELECT column_name, data_type,
  CASE WHEN column_name IN (
    'id','property_id','guest_id','owner_id','check_in','check_out',
    'nights','total_guests','subtotal','platform_fee','discount_amount',
    'total_price','coupon_code','status','booking_number',
    'owner_confirmed','cancellation_reason','created_at','updated_at'
  ) THEN '✓ esperada' ELSE '? extra' END AS auditoria
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'bookings'
ORDER BY ordinal_position;

SELECT col AS coluna_esperada, 'bookings' AS tabela, '✗ AUSENTE' AS status
FROM unnest(ARRAY[
  'id','property_id','guest_id','owner_id','check_in','check_out',
  'nights','total_guests','subtotal','platform_fee','discount_amount',
  'total_price','coupon_code','status','booking_number',
  'owner_confirmed','cancellation_reason','created_at','updated_at'
]) AS col
WHERE col NOT IN (
  SELECT column_name FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'bookings'
);


-- 2.4 installments (interface Installment)
SELECT column_name, data_type,
  CASE WHEN column_name IN (
    'id','booking_id','number','value','due_date','status','type',
    'asaas_payment_id','asaas_customer_id','paid_at','created_at','updated_at'
  ) THEN '✓ esperada' ELSE '? extra' END AS auditoria
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'installments'
ORDER BY ordinal_position;

SELECT col AS coluna_esperada, 'installments' AS tabela, '✗ AUSENTE' AS status
FROM unnest(ARRAY[
  'id','booking_id','number','value','due_date','status','type',
  'asaas_payment_id','asaas_customer_id','paid_at','created_at','updated_at'
]) AS col
WHERE col NOT IN (
  SELECT column_name FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'installments'
);


-- 2.5 contracts (interface Contract)
SELECT column_name, data_type,
  CASE WHEN column_name IN (
    'id','booking_id','guest_id','owner_id','content',
    'ip_address','user_agent','accepted_at','version','created_at','updated_at'
  ) THEN '✓ esperada' ELSE '? extra' END AS auditoria
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'contracts'
ORDER BY ordinal_position;

SELECT col AS coluna_esperada, 'contracts' AS tabela, '✗ AUSENTE' AS status
FROM unnest(ARRAY[
  'id','booking_id','guest_id','owner_id','content',
  'ip_address','user_agent','accepted_at','version','created_at','updated_at'
]) AS col
WHERE col NOT IN (
  SELECT column_name FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'contracts'
);


-- 2.6 messages (interface Message)
SELECT column_name, data_type,
  CASE WHEN column_name IN (
    'id','booking_id','sender_id','receiver_id','content',
    'subject','is_read','created_at','updated_at'
  ) THEN '✓ esperada' ELSE '? extra' END AS auditoria
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'messages'
ORDER BY ordinal_position;

SELECT col AS coluna_esperada, 'messages' AS tabela, '✗ AUSENTE' AS status
FROM unnest(ARRAY[
  'id','booking_id','sender_id','receiver_id','content',
  'subject','is_read','created_at','updated_at'
]) AS col
WHERE col NOT IN (
  SELECT column_name FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'messages'
);


-- 2.7 reviews (interface Review)
SELECT column_name, data_type,
  CASE WHEN column_name IN (
    'id','booking_id','reviewer_id','target_property_id','target_user_id',
    'rating','comment','mode','visible','created_at','updated_at'
  ) THEN '✓ esperada' ELSE '? extra' END AS auditoria
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'reviews'
ORDER BY ordinal_position;

SELECT col AS coluna_esperada, 'reviews' AS tabela, '✗ AUSENTE' AS status
FROM unnest(ARRAY[
  'id','booking_id','reviewer_id','target_property_id','target_user_id',
  'rating','comment','mode','visible','created_at','updated_at'
]) AS col
WHERE col NOT IN (
  SELECT column_name FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'reviews'
);


-- 2.8 notifications (interface Notification)
SELECT column_name, data_type,
  CASE WHEN column_name IN (
    'id','user_id','title','message','type','is_read','created_at','updated_at'
  ) THEN '✓ esperada' ELSE '? extra' END AS auditoria
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'notifications'
ORDER BY ordinal_position;

SELECT col AS coluna_esperada, 'notifications' AS tabela, '✗ AUSENTE' AS status
FROM unnest(ARRAY[
  'id','user_id','title','message','type','is_read','created_at','updated_at'
]) AS col
WHERE col NOT IN (
  SELECT column_name FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'notifications'
);


-- 2.9 price_periods (interface PricePeriod)
SELECT column_name, data_type,
  CASE WHEN column_name IN (
    'id','property_id','name','price_per_night','period_type',
    'start_date','end_date','priority','active','created_at'
  ) THEN '✓ esperada' ELSE '? extra' END AS auditoria
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'price_periods'
ORDER BY ordinal_position;

SELECT col AS coluna_esperada, 'price_periods' AS tabela, '✗ AUSENTE' AS status
FROM unnest(ARRAY[
  'id','property_id','name','price_per_night','period_type',
  'start_date','end_date','priority','active','created_at'
]) AS col
WHERE col NOT IN (
  SELECT column_name FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'price_periods'
);


-- 2.10 property_rooms (interface PropertyRoom)
SELECT column_name, data_type,
  CASE WHEN column_name IN (
    'id','property_id','name','description','display_order','created_at'
  ) THEN '✓ esperada' ELSE '? extra' END AS auditoria
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'property_rooms'
ORDER BY ordinal_position;

SELECT col AS coluna_esperada, 'property_rooms' AS tabela, '✗ AUSENTE' AS status
FROM unnest(ARRAY[
  'id','property_id','name','description','display_order','created_at'
]) AS col
WHERE col NOT IN (
  SELECT column_name FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'property_rooms'
);


-- 2.11 amenities_catalog (interface AmenityCatalog)
SELECT column_name, data_type,
  CASE WHEN column_name IN (
    'id','category','name','icon','display_order','created_at'
  ) THEN '✓ esperada' ELSE '? extra' END AS auditoria
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'amenities_catalog'
ORDER BY ordinal_position;

SELECT col AS coluna_esperada, 'amenities_catalog' AS tabela, '✗ AUSENTE' AS status
FROM unnest(ARRAY[
  'id','category','name','icon','display_order','created_at'
]) AS col
WHERE col NOT IN (
  SELECT column_name FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'amenities_catalog'
);


-- 2.12 property_amenities (interface PropertyAmenity)
SELECT column_name, data_type,
  CASE WHEN column_name IN (
    'property_id','amenity_id','created_at'
  ) THEN '✓ esperada' ELSE '? extra' END AS auditoria
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'property_amenities'
ORDER BY ordinal_position;

SELECT col AS coluna_esperada, 'property_amenities' AS tabela, '✗ AUSENTE' AS status
FROM unnest(ARRAY[
  'property_id','amenity_id','created_at'
]) AS col
WHERE col NOT IN (
  SELECT column_name FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'property_amenities'
);


-- 2.13 property_photos (interface PropertyPhoto)
SELECT column_name, data_type,
  CASE WHEN column_name IN (
    'id','property_id','room_id','url','caption','display_order','created_at'
  ) THEN '✓ esperada' ELSE '? extra' END AS auditoria
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'property_photos'
ORDER BY ordinal_position;

SELECT col AS coluna_esperada, 'property_photos' AS tabela, '✗ AUSENTE' AS status
FROM unnest(ARRAY[
  'id','property_id','room_id','url','caption','display_order','created_at'
]) AS col
WHERE col NOT IN (
  SELECT column_name FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'property_photos'
);


-- 2.14 favorites (interface Favorite)
SELECT column_name, data_type,
  CASE WHEN column_name IN (
    'id','user_id','property_id','created_at'
  ) THEN '✓ esperada' ELSE '? extra' END AS auditoria
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'favorites'
ORDER BY ordinal_position;

SELECT col AS coluna_esperada, 'favorites' AS tabela, '✗ AUSENTE' AS status
FROM unnest(ARRAY[
  'id','user_id','property_id','created_at'
]) AS col
WHERE col NOT IN (
  SELECT column_name FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'favorites'
);


-- 2.15 blocked_dates (usada no código mas sem type TS dedicado)
-- Colunas esperadas inferidas pelo uso no código (property_id, date/start_date/end_date)
SELECT column_name, data_type, '(sem type TS)' AS nota
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'blocked_dates'
ORDER BY ordinal_position;


-- 2.16 platform_settings (usada no código mas sem type TS dedicado)
SELECT column_name, data_type, '(sem type TS)' AS nota
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'platform_settings'
ORDER BY ordinal_position;


-- 2.17 cancellation_policies_config (usada no código mas sem type TS dedicado)
SELECT column_name, data_type, '(sem type TS)' AS nota
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'cancellation_policies_config'
ORDER BY ordinal_position;


-- 2.18 conversation_tickets (usada no código mas sem type TS dedicado)
SELECT column_name, data_type, '(sem type TS)' AS nota
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'conversation_tickets'
ORDER BY ordinal_position;


-- 2.19 incident_messages (usada no código mas sem type TS dedicado)
SELECT column_name, data_type, '(sem type TS)' AS nota
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'incident_messages'
ORDER BY ordinal_position;


-- 2.20 incidents (usada no código mas sem type TS dedicado)
SELECT column_name, data_type, '(sem type TS)' AS nota
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'incidents'
ORDER BY ordinal_position;


-- 2.21 coupons (interface Coupon — type TS existe mas NÃO encontrada no grep do código)
SELECT column_name, data_type,
  CASE WHEN column_name IN (
    'id','code','type','value','min_booking_value','max_uses',
    'current_uses','expires_at','active','created_at','updated_at'
  ) THEN '✓ esperada' ELSE '? extra' END AS auditoria
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'coupons'
ORDER BY ordinal_position;

SELECT col AS coluna_esperada, 'coupons' AS tabela, '✗ AUSENTE' AS status
FROM unnest(ARRAY[
  'id','code','type','value','min_booking_value','max_uses',
  'current_uses','expires_at','active','created_at','updated_at'
]) AS col
WHERE col NOT IN (
  SELECT column_name FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'coupons'
);


-- 2.22 property_pricing_rules (interface PropertyPricingRule — type TS existe mas NÃO encontrada no grep)
SELECT column_name, data_type,
  CASE WHEN column_name IN (
    'id','property_id','rule_type','multiplier','specific_dates',
    'start_date','end_date','created_at','updated_at'
  ) THEN '✓ esperada' ELSE '? extra' END AS auditoria
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'property_pricing_rules'
ORDER BY ordinal_position;

SELECT col AS coluna_esperada, 'property_pricing_rules' AS tabela, '✗ AUSENTE' AS status
FROM unnest(ARRAY[
  'id','property_id','rule_type','multiplier','specific_dates',
  'start_date','end_date','created_at','updated_at'
]) AS col
WHERE col NOT IN (
  SELECT column_name FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'property_pricing_rules'
);


-- 2.23 availability_blocks (interface AvailabilityBlock — type TS existe; código usa 'blocked_dates')
-- Verifica se ambas as tabelas existem (potencial redundância)
SELECT column_name, data_type,
  CASE WHEN column_name IN (
    'id','property_id','start_date','end_date','reason','created_at','updated_at'
  ) THEN '✓ esperada' ELSE '? extra' END AS auditoria
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'availability_blocks'
ORDER BY ordinal_position;


-- ================================================================
-- SEÇÃO 3 — RLS POLICIES
-- Lista todas as policies existentes por tabela.
-- Tabelas sem nenhuma policy são sinalizadas.
-- ================================================================

-- 3.1 Todas as policies existentes no schema public
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;


-- 3.2 Tabelas SEM nenhuma RLS policy (risco de segurança)
SELECT pt.tablename, '⚠ SEM POLICY' AS aviso
FROM pg_tables pt
WHERE pt.schemaname = 'public'
  AND pt.tablename NOT IN (
    SELECT DISTINCT tablename FROM pg_policies WHERE schemaname = 'public'
  )
ORDER BY pt.tablename;


-- 3.3 Tabelas sem RLS habilitado (row_security = off)
SELECT relname AS tabela,
  CASE relrowsecurity WHEN true THEN '✓ RLS habilitado' ELSE '✗ RLS DESABILITADO' END AS rls_status,
  CASE relforcerowsecurity WHEN true THEN 'FORCE' ELSE '' END AS force
FROM pg_class
WHERE relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND relkind = 'r'
ORDER BY relrowsecurity, relname;


-- 3.4 Verifica policies para tabelas críticas especificamente
SELECT
  expected.tabela,
  COALESCE(pol.policyname, '✗ SEM POLICY')   AS policy,
  COALESCE(pol.cmd,        '—')               AS operacao,
  COALESCE(array_to_string(pol.roles, ', '), '—') AS roles
FROM (
  VALUES
    ('users'),('properties'),('bookings'),('installments'),
    ('contracts'),('messages'),('reviews'),('notifications'),
    ('favorites'),('property_photos'),('property_amenities')
) AS expected(tabela)
LEFT JOIN pg_policies pol
  ON pol.schemaname = 'public' AND pol.tablename = expected.tabela
ORDER BY expected.tabela, pol.cmd;


-- ================================================================
-- SEÇÃO 4 — STORAGE BUCKETS
-- Verifica se os buckets usados no código existem.
-- ================================================================

-- 4.1 Todos os buckets existentes
SELECT id, name, public, file_size_limit, allowed_mime_types, created_at
FROM storage.buckets
ORDER BY name;


-- 4.2 Buckets esperados vs existentes
SELECT
  expected.bucket                                                    AS bucket_esperado,
  CASE WHEN sb.id IS NOT NULL THEN '✓ existe' ELSE '✗ AUSENTE' END AS status,
  sb.public                                                          AS publico,
  sb.file_size_limit                                                 AS limite_bytes
FROM (
  VALUES
    ('property-photos'),   -- upload de fotos de propriedades
    ('kyc'),               -- documentos KYC (identidade, endereço, vínculo)
    ('message-attachments') -- anexos de mensagens
) AS expected(bucket)
LEFT JOIN storage.buckets sb ON sb.id = expected.bucket OR sb.name = expected.bucket
ORDER BY expected.bucket;


-- 4.3 Policies de storage existentes (RLS sobre storage.objects)
SELECT
  policyname,
  tablename,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'storage'
ORDER BY tablename, policyname;


-- ================================================================
-- SEÇÃO 5 — ANÁLISE DE REDUNDÂNCIAS E INCONSISTÊNCIAS
-- ================================================================

-- 5.1 Tabelas presentes no banco mas não referenciadas no código-fonte
--     (comparar com grep results: tabelas usadas no front/back)
SELECT pt.tablename AS tabela_no_banco, '⚠ não encontrada no grep do código' AS aviso
FROM pg_tables pt
WHERE pt.schemaname = 'public'
  AND pt.tablename NOT IN (
    'users','properties','bookings','installments','contracts',
    'messages','reviews','notifications','price_periods',
    'property_rooms','amenities_catalog','property_amenities',
    'property_photos','favorites','blocked_dates',
    'platform_settings','cancellation_policies_config',
    'conversation_tickets','incident_messages','incidents',
    -- abaixo: tipos TS definidos mas grep não encontrou uso direto
    'coupons','property_pricing_rules','availability_blocks'
  )
ORDER BY pt.tablename;


-- 5.2 Possível duplicidade: blocked_dates vs availability_blocks
--     O tipo TS 'AvailabilityBlock' referencia colunas de 'availability_blocks',
--     mas o código usa '.from("blocked_dates")'. Verificar se ambas existem.
SELECT
  t.tablename,
  COUNT(c.column_name) AS num_colunas
FROM pg_tables t
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public' AND c.table_name = t.tablename
WHERE t.schemaname = 'public'
  AND t.tablename IN ('blocked_dates', 'availability_blocks')
GROUP BY t.tablename
ORDER BY t.tablename;

-- Estrutura de ambas para comparação:
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('blocked_dates', 'availability_blocks')
ORDER BY table_name, ordinal_position;


-- 5.3 Colunas de 'properties' que podem ser redundantes com property_photos
--     (a coluna 'photos' JSONB em properties vs tabela normalizada property_photos)
SELECT
  'properties.photos (JSONB)' AS mecanismo,
  COUNT(*) AS propriedades_com_photos_jsonb
FROM properties
WHERE photos IS NOT NULL AND array_length(photos::text[], 1) > 0;

SELECT
  'property_photos (tabela normalizada)' AS mecanismo,
  COUNT(DISTINCT property_id) AS propriedades_com_fotos_normalizadas
FROM property_photos;


-- 5.4 Tabelas com type TS definido mas sem uso encontrado no grep
SELECT
  tabela_ts,
  interface_ts,
  'type TS definido; nenhum .from() encontrado no código' AS aviso
FROM (
  VALUES
    ('coupons',               'Coupon'),
    ('property_pricing_rules','PropertyPricingRule'),
    ('availability_blocks',   'AvailabilityBlock')
) AS ts(tabela_ts, interface_ts)
WHERE NOT EXISTS (
  SELECT 1 FROM pg_tables pt
  WHERE pt.schemaname = 'public' AND pt.tablename = ts.tabela_ts
);


-- 5.5 Tabelas no código sem type TS correspondente
SELECT
  tabela_codigo,
  'usada no código; sem interface TS em src/types/index.ts' AS aviso
FROM (
  VALUES
    ('platform_settings'),
    ('cancellation_policies_config'),
    ('conversation_tickets'),
    ('incident_messages'),
    ('incidents')
) AS code_tables(tabela_codigo);


-- 5.6 Verificar consistência de foreign keys declaradas vs existentes
SELECT
  tc.table_name        AS tabela,
  kcu.column_name      AS coluna_fk,
  ccu.table_name       AS tabela_ref,
  ccu.column_name      AS coluna_ref,
  tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;


-- 5.7 Índices existentes nas tabelas principais
--     Colunas frequentemente filtradas devem ter índice.
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;


-- 5.8 Colunas frequentemente filtradas no código sem índice confirmado
--     (inferido do grep: .eq(), .filter(), WHERE clauses mais comuns)
WITH indexed_cols AS (
  SELECT
    tablename,
    regexp_matches(indexdef, 'ON \w+ USING \w+ \((.+)\)') AS cols
  FROM pg_indexes
  WHERE schemaname = 'public'
),
expected_indexes AS (
  SELECT * FROM (VALUES
    -- tabela, coluna, motivo
    ('bookings',     'guest_id',     '.eq(guest_id) em GuestDashboard'),
    ('bookings',     'owner_id',     '.eq(owner_id) em OwnerDashboard'),
    ('bookings',     'property_id',  'join em queries de propriedade'),
    ('bookings',     'status',       'filtro de status em dashboards'),
    ('messages',     'receiver_id',  '.eq(receiver_id) em unread + MessagesPage'),
    ('messages',     'sender_id',    '.eq(sender_id) em MessagesPage'),
    ('messages',     'is_read',      '.eq(is_read, false) em unread count'),
    ('installments', 'booking_id',   'join em checkout e dashboard'),
    ('installments', 'asaas_payment_id', 'lookup por ID de pagamento'),
    ('notifications','user_id',      '.eq(user_id) em notificações'),
    ('notifications','is_read',      '.eq(is_read, false) em contagem'),
    ('property_photos','property_id','join em galeria'),
    ('property_amenities','property_id','join em detalhes'),
    ('favorites',    'user_id',      '.eq(user_id) em favoritos'),
    ('reviews',      'target_property_id', '.eq em página de detalhes'),
    ('blocked_dates','property_id',  'lookup de disponibilidade')
  ) AS t(tabela, coluna, motivo)
)
SELECT
  ei.tabela,
  ei.coluna,
  ei.motivo,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_indexes pi2
      WHERE pi2.schemaname = 'public'
        AND pi2.tablename = ei.tabela
        AND pi2.indexdef ILIKE '%(' || ei.coluna || ')%'
    ) THEN '✓ índice existe'
    ELSE '⚠ SEM ÍNDICE — considerar criar'
  END AS status_indice
FROM expected_indexes ei
ORDER BY ei.tabela, ei.coluna;


-- ================================================================
-- SEÇÃO 6 — RESUMO EXECUTIVO
-- ================================================================

WITH
tables_ok AS (
  SELECT COUNT(*) AS n FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename IN (
      'users','properties','bookings','installments','contracts',
      'messages','reviews','notifications','price_periods',
      'property_rooms','amenities_catalog','property_amenities',
      'property_photos','favorites','blocked_dates',
      'platform_settings','cancellation_policies_config',
      'conversation_tickets','incident_messages','incidents'
    )
),
tables_total AS (SELECT 20 AS n),
rls_ok AS (
  SELECT COUNT(DISTINCT tablename) AS n FROM pg_policies WHERE schemaname = 'public'
),
buckets_ok AS (
  SELECT COUNT(*) AS n FROM storage.buckets
  WHERE id IN ('property-photos','kyc','message-attachments')
     OR name IN ('property-photos','kyc','message-attachments')
)
SELECT
  tables_ok.n   || ' / ' || tables_total.n AS tabelas_encontradas,
  rls_ok.n                                  AS tabelas_com_policy,
  buckets_ok.n  || ' / 3'                  AS buckets_encontrados
FROM tables_ok, tables_total, rls_ok, buckets_ok;

-- ================================================================
-- FIM DO SCRIPT DE AUDITORIA
-- ================================================================
