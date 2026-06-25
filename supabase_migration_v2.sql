-- =================================================================
-- Migration v2: QR check-in + approval workflow
-- Jalankan di Supabase SQL Editor setelah backup.
-- Rollback: lihat bagian bawah file ini.
-- =================================================================

-- 1. Tambah kolom ke rsvps
alter table public.rsvps
  add column if not exists qr_token uuid unique default gen_random_uuid(),
  add column if not exists is_approved boolean not null default true,
  add column if not exists card_sent_at timestamptz,
  add column if not exists checked_in boolean not null default false;

-- 2. Index untuk lookup QR token
create index if not exists idx_rsvps_qr_token on public.rsvps (qr_token);

-- 3. Tabel guest_checkins
create table if not exists public.guest_checkins (
  id uuid primary key default gen_random_uuid(),
  rsvp_id uuid not null references public.rsvps (id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  checked_in_by uuid references public.admin_users (id) on delete set null,
  method text not null check (method in ('qr', 'manual')),
  guest_count_actual int default 1,
  constraint guest_checkins_rsvp_unq unique (rsvp_id)
);

create index if not exists idx_checkins_rsvp on public.guest_checkins (rsvp_id);
create index if not exists idx_checkins_time on public.guest_checkins (checked_in_at desc);

-- 4. RLS untuk guest_checkins
alter table public.guest_checkins enable row level security;

create policy "checkins_insert_admin" on public.guest_checkins
  for insert to authenticated
  with check (is_admin_user());

create policy "checkins_select_admin" on public.guest_checkins
  for select to authenticated
  using (is_admin_user());

create policy "checkins_super_admin" on public.guest_checkins
  for all to authenticated
  using (is_super_admin())
  with check (is_super_admin());

-- =================================================================
-- ROLLBACK (jalankan jika perlu):
--
-- drop policy if exists "checkins_super_admin" on public.guest_checkins;
-- drop policy if exists "checkins_select_admin" on public.guest_checkins;
-- drop policy if exists "checkins_insert_admin" on public.guest_checkins;
-- drop table if exists public.guest_checkins;
-- alter table public.rsvps
--   drop column if exists checked_in,
--   drop column if exists card_sent_at,
--   drop column if exists is_approved,
--   drop column if exists qr_token;
-- =================================================================