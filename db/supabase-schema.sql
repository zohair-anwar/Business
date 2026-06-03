-- =========================================================
-- Off Watch Wellness — Supabase / Postgres schema
-- Run this in Supabase → SQL Editor before going live.
-- =========================================================

create table if not exists public.waitlist (
  id           uuid primary key default gen_random_uuid(),
  name         text,
  email        text not null unique,   -- unique → duplicate signups return 409
  role         text,
  province     text,
  consent      boolean not null default false,
  source       text,
  submitted_at timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

create index if not exists waitlist_submitted_at_idx
  on public.waitlist (submitted_at desc);

-- Row Level Security: lock the table down. The API uses the
-- SERVICE ROLE key, which bypasses RLS, so no policies are needed
-- for inserts from the serverless function. This simply ensures
-- the anon/public key can never read or write the list.
alter table public.waitlist enable row level security;

-- (Intentionally no policies → anon role has no access.)
