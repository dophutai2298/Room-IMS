-- Ticket 04: owner-scoped historical billing. Imported invoices are immutable to the importer,
-- while operational updates remain subject to the constraints and RLS below.
create table public.utility_metrics (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  month integer not null check (month between 1 and 12),
  year integer not null check (year between 2000 and 2100),
  electricity_old numeric(12,2) not null default 0 check (electricity_old >= 0),
  electricity_new numeric(12,2) not null default 0 check (electricity_new >= electricity_old),
  water_old numeric(12,2) not null default 0 check (water_old >= 0),
  water_new numeric(12,2) not null default 0 check (water_new >= water_old),
  owner_app_user_id uuid not null references public.app_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (room_id, month, year)
);

create table public.utility_pricing (
  id uuid primary key default gen_random_uuid(),
  effective_from date not null,
  electricity_unit_price numeric(12,2) not null check (electricity_unit_price >= 0),
  water_unit_price numeric(12,2) not null check (water_unit_price >= 0),
  is_active boolean not null default true,
  owner_app_user_id uuid not null references public.app_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_app_user_id, effective_from)
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  month integer not null check (month between 1 and 12),
  year integer not null check (year between 2000 and 2100),
  room_fee numeric(12,2) not null default 0 check (room_fee >= 0),
  electricity_fee numeric(12,2) not null default 0 check (electricity_fee >= 0),
  water_fee numeric(12,2) not null default 0 check (water_fee >= 0),
  other_fee numeric(12,2) not null default 0,
  other_fee_note text,
  discount_amount numeric(12,2) not null default 0 check (discount_amount >= 0),
  discount_note text,
  total_amount numeric(12,2) not null default 0 check (total_amount >= 0),
  amount_paid numeric(12,2) not null default 0 check (amount_paid between 0 and total_amount),
  status text not null default 'Unpaid' check (status in ('Unpaid', 'Partially Paid', 'Paid')),
  owner_app_user_id uuid not null references public.app_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (room_id, month, year),
  constraint invoices_status_matches_payment check (
    (status = 'Unpaid' and amount_paid = 0)
    or (status = 'Paid' and amount_paid = total_amount)
    or (status = 'Partially Paid' and amount_paid > 0 and amount_paid < total_amount)
  )
);

create index utility_metrics_owner_room_period on public.utility_metrics(owner_app_user_id, room_id, year, month);
create index utility_pricing_owner_effective on public.utility_pricing(owner_app_user_id, effective_from);
create index invoices_owner_room_period on public.invoices(owner_app_user_id, room_id, year, month);

create function public.enforce_billing_room_owner() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.rooms r where r.id = new.room_id and r.owner_app_user_id = new.owner_app_user_id)
  then raise exception 'Billing Room owner mismatch' using errcode = '23514'; end if;
  return new;
end;
$$;
create trigger utility_metric_room_owner before insert or update on public.utility_metrics
for each row execute function public.enforce_billing_room_owner();
create trigger invoice_room_owner before insert or update on public.invoices
for each row execute function public.enforce_billing_room_owner();

alter table public.utility_metrics enable row level security;
alter table public.utility_pricing enable row level security;
alter table public.invoices enable row level security;
revoke all on public.utility_metrics, public.utility_pricing, public.invoices from public, anon, authenticated;
grant select, insert on public.utility_metrics, public.invoices to authenticated;
grant select on public.utility_pricing to authenticated;
grant update (electricity_old, electricity_new, water_old, water_new, updated_at) on public.utility_metrics to authenticated;
grant update (room_fee, electricity_fee, water_fee, other_fee, other_fee_note, discount_amount, discount_note, total_amount, amount_paid, status, updated_at) on public.invoices to authenticated;
grant insert on public.utility_pricing to authenticated;
grant update (electricity_unit_price, water_unit_price, is_active, updated_at) on public.utility_pricing to authenticated;
grant select, insert, update, delete on public.utility_metrics, public.utility_pricing, public.invoices to service_role;

create policy utility_metrics_read on public.utility_metrics for select to authenticated using
  (owner_app_user_id = (select public.current_app_user_owner_id()));
create policy utility_metrics_create on public.utility_metrics for insert to authenticated with check
  (owner_app_user_id = (select public.current_app_user_owner_id()));
create policy utility_metrics_landlord_update on public.utility_metrics for update to authenticated using
  ((select public.current_app_user_is_landlord()) and owner_app_user_id = (select public.current_app_user_owner_id())) with check
  ((select public.current_app_user_is_landlord()) and owner_app_user_id = (select public.current_app_user_owner_id()));
create policy utility_pricing_read on public.utility_pricing for select to authenticated using
  (owner_app_user_id = (select public.current_app_user_owner_id()));
create policy utility_pricing_landlord_create on public.utility_pricing for insert to authenticated with check
  ((select public.current_app_user_is_landlord()) and owner_app_user_id = (select public.current_app_user_owner_id()));
create policy utility_pricing_landlord_update on public.utility_pricing for update to authenticated using
  ((select public.current_app_user_is_landlord()) and owner_app_user_id = (select public.current_app_user_owner_id())) with check
  ((select public.current_app_user_is_landlord()) and owner_app_user_id = (select public.current_app_user_owner_id()));
create policy invoices_read on public.invoices for select to authenticated using
  (owner_app_user_id = (select public.current_app_user_owner_id()));
create policy invoices_create on public.invoices for insert to authenticated with check
  (owner_app_user_id = (select public.current_app_user_owner_id()));
create policy invoices_landlord_update on public.invoices for update to authenticated using
  ((select public.current_app_user_is_landlord()) and owner_app_user_id = (select public.current_app_user_owner_id())) with check
  ((select public.current_app_user_is_landlord()) and owner_app_user_id = (select public.current_app_user_owner_id()));
