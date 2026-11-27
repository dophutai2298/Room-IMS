-- Ticket 02: application-owned foundation only. Never restore InsForge auth/storage schemas.
-- Apply to an isolated Supabase project before importing any application rows.
create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete restrict,
  email text not null unique,
  display_name text not null,
  role text not null check (role in ('landlord', 'staff')),
  status text not null default 'active' check (status in ('active', 'disabled')),
  credential_ready boolean not null default false,
  owner_app_user_id uuid not null references public.app_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_users_owner_shape check (
    (role = 'landlord' and owner_app_user_id = id)
    or (role = 'staff' and owner_app_user_id <> id)
  )
);

create index if not exists app_users_owner_role_idx
  on public.app_users(owner_app_user_id, role);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  floor integer check (floor is null or floor between 0 and 200),
  status text not null default 'Available'
    check (status in ('Available', 'Occupied', 'Maintenance')),
  base_price numeric(12, 2) not null default 0 check (base_price >= 0),
  owner_app_user_id uuid not null references public.app_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rooms_owner_name_idx
  on public.rooms(owner_app_user_id, name);

-- These helpers run as the migration owner, with an empty search path.
-- They read only the current auth subject's active application mapping.
create or replace function public.current_app_user_owner_id()
returns uuid language sql stable security definer set search_path = ''
as $$
  select owner_app_user_id
  from public.app_users
  where auth_user_id = (select auth.uid()) and status = 'active'
    and credential_ready = true
  limit 1;
$$;

create or replace function public.current_app_user_is_landlord()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.app_users
    where auth_user_id = (select auth.uid())
      and role = 'landlord' and status = 'active'
      and credential_ready = true
  );
$$;

revoke all on function public.current_app_user_owner_id() from public, anon;
revoke all on function public.current_app_user_is_landlord() from public, anon;
grant execute on function public.current_app_user_owner_id() to authenticated;
grant execute on function public.current_app_user_is_landlord() to authenticated;

alter table public.app_users enable row level security;
alter table public.rooms enable row level security;

revoke all on public.app_users from public, anon, authenticated;
revoke all on public.rooms from public, anon, authenticated;
grant select on public.app_users to authenticated;
grant update (display_name, status, updated_at) on public.app_users to authenticated;
grant select, insert, delete on public.rooms to authenticated;
grant update (name, floor, status, base_price, updated_at) on public.rooms to authenticated;
grant select, insert, update, delete on public.app_users to service_role;
grant select, insert, update, delete on public.rooms to service_role;

create policy app_users_read_scope on public.app_users
  for select to authenticated using (
    (auth_user_id = (select auth.uid()) and status = 'active'
      and credential_ready = true)
    or (
      (select public.current_app_user_is_landlord())
      and owner_app_user_id = (select public.current_app_user_owner_id())
    )
  );

create policy app_users_landlord_update_staff on public.app_users
  for update to authenticated using (
    (select public.current_app_user_is_landlord())
    and role = 'staff'
    and owner_app_user_id = (select public.current_app_user_owner_id())
  ) with check (
    (select public.current_app_user_is_landlord())
    and role = 'staff'
    and owner_app_user_id = (select public.current_app_user_owner_id())
  );

create policy rooms_read_scope on public.rooms
  for select to authenticated using (
    owner_app_user_id = (select public.current_app_user_owner_id())
  );

create policy rooms_create_scope on public.rooms
  for insert to authenticated with check (
    owner_app_user_id = (select public.current_app_user_owner_id())
    and status in ('Available', 'Maintenance')
  );

create policy rooms_landlord_update on public.rooms
  for update to authenticated using (
    (select public.current_app_user_is_landlord())
    and owner_app_user_id = (select public.current_app_user_owner_id())
  ) with check (
    (select public.current_app_user_is_landlord())
    and owner_app_user_id = (select public.current_app_user_owner_id())
  );

create policy rooms_landlord_delete on public.rooms
  for delete to authenticated using (
    (select public.current_app_user_is_landlord())
    and owner_app_user_id = (select public.current_app_user_owner_id())
  );
