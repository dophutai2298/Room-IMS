-- Ticket 03: application entities and private identity-document storage.
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.rooms(id) on delete set null,
  full_name text not null,
  phone text,
  date_of_birth text,
  permanent_address text,
  cccd_number text,
  is_key_tenant boolean not null default false,
  cccd_front_url text,
  cccd_back_url text,
  status text not null default 'Active' check (status in ('Active', 'Moved Out')),
  owner_app_user_id uuid not null references public.app_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  key_tenant_id uuid not null references public.tenants(id) on delete restrict,
  deposit_amount numeric(12,2) not null default 0 check (deposit_amount >= 0),
  rent_amount numeric(12,2) check (rent_amount is null or rent_amount >= 0),
  electricity_price_override numeric(12,2) check (electricity_price_override is null or electricity_price_override >= 0),
  water_price_override numeric(12,2) check (water_price_override is null or water_price_override >= 0),
  start_date date not null,
  end_date date,
  status text not null default 'Active' check (status in ('Active', 'Terminated')),
  owner_app_user_id uuid not null references public.app_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contract_date_order check (end_date is null or end_date >= start_date)
);

create unique index one_active_contract_per_room on public.contracts(room_id) where status = 'Active';

create table public.tenant_cccd_images (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  storage_key text not null unique,
  file_name text,
  mime_type text,
  file_size bigint check (file_size is null or file_size >= 0),
  sha256 text,
  source_kind text not null default 'storage' check (source_kind in ('storage','legacy-front','legacy-back')),
  owner_app_user_id uuid not null references public.app_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tenants_owner_room_idx on public.tenants(owner_app_user_id, room_id);
create index tenants_owner_name_idx on public.tenants(owner_app_user_id, full_name);
create index contracts_owner_room_idx on public.contracts(owner_app_user_id, room_id);
create index tenant_images_owner_tenant_idx on public.tenant_cccd_images(owner_app_user_id, tenant_id);

-- Security-definer helpers are used by Storage policies; only membership is exposed.
create function public.can_access_tenant_document(document_owner uuid, document_tenant uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.app_users u join public.tenants t
      on t.owner_app_user_id = u.owner_app_user_id
    where u.auth_user_id = (select auth.uid()) and u.status = 'active'
      and u.credential_ready = true and u.owner_app_user_id = document_owner
      and t.id = document_tenant
  );
$$;
create function public.can_delete_tenant_document(document_owner uuid, document_tenant uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.can_access_tenant_document(document_owner, document_tenant)
    and public.current_app_user_is_landlord();
$$;
revoke all on function public.can_access_tenant_document(uuid,uuid) from public, anon;
revoke all on function public.can_delete_tenant_document(uuid,uuid) from public, anon;
grant execute on function public.can_access_tenant_document(uuid,uuid) to authenticated;
grant execute on function public.can_delete_tenant_document(uuid,uuid) to authenticated;

create function public.enforce_tenant_room_owner() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.room_id is not null and not exists (
    select 1 from public.rooms r where r.id = new.room_id and r.owner_app_user_id = new.owner_app_user_id
  ) then raise exception 'Tenant Room owner mismatch' using errcode = '23514'; end if;
  return new;
end;
$$;
create trigger tenant_room_owner before insert or update on public.tenants
for each row execute function public.enforce_tenant_room_owner();

create function public.enforce_contract_links() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.rooms r where r.id = new.room_id and r.owner_app_user_id = new.owner_app_user_id)
    or not exists (select 1 from public.tenants t where t.id = new.key_tenant_id
      and t.room_id = new.room_id and t.owner_app_user_id = new.owner_app_user_id)
  then raise exception 'Contract Room/Key Tenant owner mismatch' using errcode = '23514'; end if;
  if new.status = 'Active' and not exists (
    select 1 from public.tenants t where t.id = new.key_tenant_id and t.status = 'Active'
  ) then raise exception 'Active Contract requires active Key Tenant' using errcode = '23514'; end if;
  return new;
end;
$$;
create trigger contract_links before insert or update on public.contracts
for each row execute function public.enforce_contract_links();

create function public.prevent_tenant_contract_breakage() returns trigger
language plpgsql set search_path = '' as $$
begin
  if exists (select 1 from public.contracts c where c.key_tenant_id = new.id
    and (c.room_id is distinct from new.room_id
      or c.owner_app_user_id <> new.owner_app_user_id
      or (c.status = 'Active' and new.status <> 'Active')))
  then raise exception 'Tenant is referenced by an incompatible Contract' using errcode = '23514'; end if;
  return new;
end;
$$;
create trigger tenant_contract_integrity before update on public.tenants
for each row execute function public.prevent_tenant_contract_breakage();

create function public.enforce_image_links() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.tenants t where t.id = new.tenant_id and t.owner_app_user_id = new.owner_app_user_id)
    or split_part(new.storage_key, '/', 1) <> new.owner_app_user_id::text
    or split_part(new.storage_key, '/', 2) <> new.tenant_id::text
  then raise exception 'Document owner/path mismatch' using errcode = '23514'; end if;
  return new;
end;
$$;
create trigger tenant_image_links before insert or update on public.tenant_cccd_images
for each row execute function public.enforce_image_links();

alter table public.tenants enable row level security;
alter table public.contracts enable row level security;
alter table public.tenant_cccd_images enable row level security;
revoke all on public.tenants, public.contracts, public.tenant_cccd_images from public, anon, authenticated;
grant select, insert, delete on public.tenants, public.contracts, public.tenant_cccd_images to authenticated;
grant update (room_id, full_name, phone, date_of_birth, permanent_address, cccd_number, status, is_key_tenant, cccd_front_url, cccd_back_url, updated_at) on public.tenants to authenticated;
grant update (key_tenant_id, deposit_amount, rent_amount, electricity_price_override, water_price_override, start_date, end_date, status, updated_at) on public.contracts to authenticated;
grant select, insert, update, delete on public.tenants, public.contracts, public.tenant_cccd_images to service_role;

create policy tenants_read on public.tenants for select to authenticated using
  (owner_app_user_id = (select public.current_app_user_owner_id()));
create policy tenants_create on public.tenants for insert to authenticated with check
  (owner_app_user_id = (select public.current_app_user_owner_id()));
create policy tenants_update on public.tenants for update to authenticated using
  ((select public.current_app_user_is_landlord()) and owner_app_user_id = (select public.current_app_user_owner_id())) with check
  ((select public.current_app_user_is_landlord()) and owner_app_user_id = (select public.current_app_user_owner_id()));
create policy tenants_delete on public.tenants for delete to authenticated using
  ((select public.current_app_user_is_landlord()) and owner_app_user_id = (select public.current_app_user_owner_id()));

create policy contracts_read on public.contracts for select to authenticated using
  (owner_app_user_id = (select public.current_app_user_owner_id()));
create policy contracts_create on public.contracts for insert to authenticated with check
  (owner_app_user_id = (select public.current_app_user_owner_id()));
create policy contracts_update on public.contracts for update to authenticated using
  ((select public.current_app_user_is_landlord()) and owner_app_user_id = (select public.current_app_user_owner_id())) with check
  ((select public.current_app_user_is_landlord()) and owner_app_user_id = (select public.current_app_user_owner_id()));
create policy contracts_delete on public.contracts for delete to authenticated using
  ((select public.current_app_user_is_landlord()) and owner_app_user_id = (select public.current_app_user_owner_id()));

create policy tenant_images_read on public.tenant_cccd_images for select to authenticated using
  (owner_app_user_id = (select public.current_app_user_owner_id()));
create policy tenant_images_create on public.tenant_cccd_images for insert to authenticated with check
  (owner_app_user_id = (select public.current_app_user_owner_id()));
create policy tenant_images_delete on public.tenant_cccd_images for delete to authenticated using
  ((select public.current_app_user_is_landlord()) and owner_app_user_id = (select public.current_app_user_owner_id()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tenant-cccd-private', 'tenant-cccd-private', false, 5242880,
  array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do nothing;

create policy tenant_documents_read on storage.objects for select to authenticated using (
  bucket_id = 'tenant-cccd-private' and
  public.can_access_tenant_document(
    (storage.foldername(name))[1]::uuid, (storage.foldername(name))[2]::uuid)
);
create policy tenant_documents_create on storage.objects for insert to authenticated with check (
  bucket_id = 'tenant-cccd-private' and
  public.can_access_tenant_document(
    (storage.foldername(name))[1]::uuid, (storage.foldername(name))[2]::uuid)
);
create policy tenant_documents_delete on storage.objects for delete to authenticated using (
  bucket_id = 'tenant-cccd-private' and
  public.can_delete_tenant_document(
    (storage.foldername(name))[1]::uuid, (storage.foldername(name))[2]::uuid)
);
