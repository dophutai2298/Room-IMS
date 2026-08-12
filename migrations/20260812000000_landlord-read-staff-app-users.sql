-- Allow a signed-in Landlord to list Staff profiles without exposing the
-- project admin API key to routine operational reads.

CREATE OR REPLACE FUNCTION public.current_app_user_is_landlord()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.app_users
    WHERE auth_user_id = auth.uid()
      AND role = 'landlord'
  );
$$;

REVOKE ALL ON FUNCTION public.current_app_user_is_landlord() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_app_user_is_landlord() TO authenticated;

DROP POLICY IF EXISTS "authenticated_landlord_read_app_users"
ON public.app_users;

CREATE POLICY "authenticated_landlord_read_app_users"
ON public.app_users FOR SELECT TO authenticated
USING (public.current_app_user_is_landlord());
