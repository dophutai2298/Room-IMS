-- Durable, single-use recovery proofs. Only the server's secret-key client may use these.
create table if not exists public.password_reset_cooldowns (
  email_key text primary key,
  next_allowed_at timestamptz not null
);

create table if not exists public.password_reset_proofs (
  token_hash text primary key,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists password_reset_proofs_expiry_idx
  on public.password_reset_proofs(expires_at);

alter table public.password_reset_cooldowns enable row level security;
alter table public.password_reset_proofs enable row level security;
revoke all on public.password_reset_cooldowns from public, anon, authenticated;
revoke all on public.password_reset_proofs from public, anon, authenticated;
grant select, insert, update, delete on public.password_reset_cooldowns to service_role;
grant select, insert, update, delete on public.password_reset_proofs to service_role;

create or replace function public.reserve_password_reset_request(p_email_key text)
returns timestamptz language sql volatile security definer set search_path = ''
as $$
  insert into public.password_reset_cooldowns(email_key, next_allowed_at)
  values (p_email_key, now() + interval '60 seconds')
  on conflict (email_key) do update
    set next_allowed_at = now() + interval '60 seconds'
    where public.password_reset_cooldowns.next_allowed_at <= now()
  returning next_allowed_at;
$$;

create or replace function public.consume_password_reset_proof(
  p_token_hash text,
  p_email text
)
returns uuid language sql volatile security definer set search_path = ''
as $$
  update public.password_reset_proofs as proof
  set consumed_at = now()
  where proof.token_hash = p_token_hash
    and proof.email = lower(p_email)
    and proof.consumed_at is null
    and proof.expires_at > now()
    and exists (
      select 1 from public.app_users as app_user
      where app_user.auth_user_id = proof.auth_user_id
        and app_user.status = 'active'
    )
  returning proof.auth_user_id;
$$;

revoke all on function public.reserve_password_reset_request(text) from public, anon, authenticated;
revoke all on function public.consume_password_reset_proof(text, text) from public, anon, authenticated;
grant execute on function public.reserve_password_reset_request(text) to service_role;
grant execute on function public.consume_password_reset_proof(text, text) to service_role;
