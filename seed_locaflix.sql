-- ============================================================
-- LOCAFLIX — Seed de usuários de teste
-- Execute no SQL Editor do Supabase
-- ============================================================

-- ============================================================
-- 1. CRIAR / ATUALIZAR ADMIN
-- denilson.silva.santos@gmail.com / admin123
-- ============================================================
DO $$
DECLARE
  v_admin_id uuid;
BEGIN
  SELECT id INTO v_admin_id FROM auth.users WHERE email = 'denilson.silva.santos@gmail.com';

  IF v_admin_id IS NULL THEN
    -- Conta não existe — cria do zero
    v_admin_id := gen_random_uuid();

    INSERT INTO auth.users (
      id, instance_id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
      v_admin_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'denilson.silva.santos@gmail.com',
      crypt('admin123', gen_salt('bf', 10)),
      NOW(),
      '{"provider":"email","providers":["email"]}',
      '{"name":"Denilson Admin","role":"ADMIN"}',
      NOW(), NOW(), '', '', '', ''
    );

    RAISE NOTICE 'Admin criado: denilson.silva.santos@gmail.com';
  ELSE
    -- Conta já existe — força senha admin123
    UPDATE auth.users
    SET encrypted_password = crypt('admin123', gen_salt('bf', 10)),
        email_confirmed_at = COALESCE(email_confirmed_at, NOW())
    WHERE id = v_admin_id;

    RAISE NOTICE 'Admin já existe — senha redefinida para admin123';
  END IF;

  -- Garante registro em public.users com role ADMIN
  INSERT INTO public.users (id, email, name, role, kyc_status)
  VALUES (v_admin_id, 'denilson.silva.santos@gmail.com', 'Denilson Admin', 'ADMIN', 'APROVADO')
  ON CONFLICT (id) DO UPDATE SET
    role       = 'ADMIN',
    kyc_status = 'APROVADO',
    name       = COALESCE(EXCLUDED.name, 'Denilson Admin');
END $$;

-- ============================================================
-- 2. CRIAR HÓSPEDE DE TESTE
-- hospede@locaflix.com / hospede123
-- ============================================================
DO $$
DECLARE
  v_guest_id uuid := gen_random_uuid();
BEGIN
  -- Só cria se não existir
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'hospede@locaflix.com') THEN

    INSERT INTO auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change
    ) VALUES (
      v_guest_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'hospede@locaflix.com',
      crypt('hospede123', gen_salt('bf', 10)),
      NOW(),
      '{"provider":"email","providers":["email"]}',
      '{"name":"Maria Silva","role":"GUEST"}',
      NOW(),
      NOW(),
      '', '', '', ''
    );

    -- O trigger handle_new_user cria o registro em public.users automaticamente.
    -- Se por algum motivo não criar, inserimos manualmente:
    INSERT INTO public.users (id, email, name, role, kyc_status)
    VALUES (v_guest_id, 'hospede@locaflix.com', 'Maria Silva', 'GUEST', 'APROVADO')
    ON CONFLICT (id) DO UPDATE SET
      name       = 'Maria Silva',
      role       = 'GUEST',
      kyc_status = 'APROVADO';

    RAISE NOTICE 'Hóspede criado: hospede@locaflix.com';
  ELSE
    -- Garante role correta caso já exista
    UPDATE public.users
    SET role = 'GUEST', kyc_status = 'APROVADO', name = COALESCE(name, 'Maria Silva')
    WHERE email = 'hospede@locaflix.com';

    RAISE NOTICE 'Hóspede já existe — role atualizada para GUEST';
  END IF;
END $$;

-- ============================================================
-- 3. CRIAR ANFITRIÃO DE TESTE
-- anfitriao@locaflix.com / anfitriao123
-- ============================================================
DO $$
DECLARE
  v_owner_id uuid := gen_random_uuid();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'anfitriao@locaflix.com') THEN

    INSERT INTO auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change
    ) VALUES (
      v_owner_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'anfitriao@locaflix.com',
      crypt('anfitriao123', gen_salt('bf', 10)),
      NOW(),
      '{"provider":"email","providers":["email"]}',
      '{"name":"Carlos Oliveira","role":"OWNER"}',
      NOW(),
      NOW(),
      '', '', '', ''
    );

    INSERT INTO public.users (id, email, name, role, kyc_status)
    VALUES (v_owner_id, 'anfitriao@locaflix.com', 'Carlos Oliveira', 'OWNER', 'APROVADO')
    ON CONFLICT (id) DO UPDATE SET
      name       = 'Carlos Oliveira',
      role       = 'OWNER',
      kyc_status = 'APROVADO';

    RAISE NOTICE 'Anfitrião criado: anfitriao@locaflix.com';
  ELSE
    UPDATE public.users
    SET role = 'OWNER', kyc_status = 'APROVADO', name = COALESCE(name, 'Carlos Oliveira')
    WHERE email = 'anfitriao@locaflix.com';

    RAISE NOTICE 'Anfitrião já existe — role atualizada para OWNER';
  END IF;
END $$;

-- ============================================================
-- 4. VERIFICAR RESULTADO
-- ============================================================
SELECT
  u.email,
  u.name,
  u.role,
  u.kyc_status,
  au.created_at AS auth_created_at
FROM public.users u
JOIN auth.users au ON au.id = u.id
WHERE u.email IN (
  'denilson.silva.santos@gmail.com',
  'hospede@locaflix.com',
  'anfitriao@locaflix.com'
)
ORDER BY u.role;
