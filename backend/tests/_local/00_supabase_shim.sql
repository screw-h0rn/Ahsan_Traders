-- ============================================================================
-- Supabase shim for LOCAL VALIDATION ONLY. Never applied to a real project.
--
-- Recreates just enough of what Supabase provides out of the box — the `auth`
-- schema, `auth.uid()`, and the anon/authenticated/service_role roles — so the
-- real migrations can be applied to a plain PostgreSQL instance and exercised
-- offline. On a real Supabase project all of this already exists.
--
-- Identity is simulated with a session GUC (`request.jwt.claim.sub`), which is
-- exactly how Supabase surfaces the signed-in user id to Postgres.
-- ============================================================================

create schema if not exists auth;

create table if not exists auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text unique,
  phone              text unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now()
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end
$$;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;
grant select on auth.users to authenticated, service_role;

-- Test helper: become a given user for the rest of the transaction.
create or replace function auth.login_as(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_user_id::text, ''), true);
end;
$$;

-- ----------------------------------------------------------------------------
-- Minimal Supabase Storage shim — schema-compatible only.
--
-- This does not implement the Storage API (upload/download), only enough of
-- storage.buckets / storage.objects for migrations that declare a bucket and
-- RLS policies on it to apply cleanly against plain PostgreSQL. Nothing here
-- is exercised by the test suite; it exists so `pnpm db:local` keeps working
-- end to end as the schema grows.
-- ----------------------------------------------------------------------------
create schema if not exists storage;

create table if not exists storage.buckets (
  id                 text primary key,
  name               text not null,
  public             boolean not null default false,
  file_size_limit    bigint,
  allowed_mime_types text[],
  created_at         timestamptz not null default now()
);

create table if not exists storage.objects (
  id         uuid primary key default gen_random_uuid(),
  bucket_id  text references storage.buckets (id),
  name       text,
  owner      uuid,
  metadata   jsonb,
  created_at timestamptz not null default now()
);

alter table storage.objects enable row level security;
grant select on storage.buckets to anon, authenticated, service_role;
grant select, insert, update, delete on storage.objects to authenticated, service_role;
grant select on storage.objects to anon;
