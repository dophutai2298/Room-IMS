-- Disposable PostgreSQL restore drill only. Never apply this to InsForge or Supabase.
-- The InsForge SQL export emits RLS policies before its function definitions and
-- references provider-managed role/auth.uid(). These placeholders let PostgreSQL
-- parse that DDL; the export replaces the public functions at its end.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END $$;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS 'SELECT NULL::uuid';
CREATE FUNCTION public.current_app_user_is_landlord() RETURNS boolean LANGUAGE sql STABLE AS 'SELECT false';
CREATE FUNCTION public.current_app_user_owner_id() RETURNS uuid LANGUAGE sql STABLE AS 'SELECT NULL::uuid';
CREATE FUNCTION public.enforce_contract_key_tenant_same_room() RETURNS trigger LANGUAGE plpgsql AS 'BEGIN RETURN NEW; END;';
