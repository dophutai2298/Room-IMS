-- Server-only audit of source/target identity references for restartable imports.
-- This table is never exposed to browser or ordinary operational requests.
create table if not exists public.migration_identity_map (
  source_auth_user_id uuid primary key,
  target_auth_user_id uuid not null unique references auth.users(id) on delete restrict,
  app_user_id uuid not null unique,
  email text not null unique,
  source_email_verified boolean not null,
  created_at timestamptz not null default now()
);

alter table public.migration_identity_map enable row level security;
revoke all on public.migration_identity_map from public, anon, authenticated;
grant select, insert on public.migration_identity_map to service_role;
