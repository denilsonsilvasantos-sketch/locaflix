-- ============================================================
-- KYC Storage bucket + RLS policies
-- Run this once in the Supabase SQL Editor (or via supabase db push)
-- ============================================================

-- 1. Create the bucket (public = false so URLs require auth or service role)
insert into storage.buckets (id, name, public)
values ('kyc', 'kyc', false)
on conflict (id) do nothing;

-- 2. Drop existing policies before recreating (idempotent)
drop policy if exists "kyc: user can upload own files"  on storage.objects;
drop policy if exists "kyc: user can update own files"  on storage.objects;
drop policy if exists "kyc: user can read own files"    on storage.objects;
drop policy if exists "kyc: admin can read all files"   on storage.objects;

-- 3. Allow authenticated users to upload/replace only their own files
--    Path convention: <user_id>/<fieldKey>.<ext>
create policy "kyc: user can upload own files"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'kyc'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "kyc: user can update own files"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'kyc'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 4. Allow authenticated users to read their own files
create policy "kyc: user can read own files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'kyc'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 5. Allow admins (role = 'ADMIN' in public.users) to read all KYC files
create policy "kyc: admin can read all files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'kyc'
    and exists (
      select 1 from public.users
      where id = auth.uid() and role = 'ADMIN'
    )
  );
