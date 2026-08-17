-- Ticket 19: Staff soft-delete/deactivation and create-only data policies.

ALTER TABLE public.app_users
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'disabled'));

UPDATE public.app_users
SET status = 'active'
WHERE status IS NULL;

DROP POLICY IF EXISTS "Cho phép tất cả trên rooms" ON public.rooms;
DROP POLICY IF EXISTS "Cho phép tất cả trên tenants" ON public.tenants;
DROP POLICY IF EXISTS "Cho phép tất cả trên contracts" ON public.contracts;
DROP POLICY IF EXISTS "Cho phép tất cả trên utility_metrics" ON public.utility_metrics;
DROP POLICY IF EXISTS "Cho phép tất cả trên invoices" ON public.invoices;
DROP POLICY IF EXISTS "authenticated_manage_rooms" ON public.rooms;
DROP POLICY IF EXISTS "authenticated_manage_tenants" ON public.tenants;
DROP POLICY IF EXISTS "authenticated_manage_tenant_cccd_images" ON public.tenant_cccd_images;
DROP POLICY IF EXISTS "authenticated_manage_contracts" ON public.contracts;
DROP POLICY IF EXISTS "authenticated_manage_utility_metrics" ON public.utility_metrics;
DROP POLICY IF EXISTS "authenticated_manage_utility_pricing" ON public.utility_pricing;
DROP POLICY IF EXISTS "authenticated_manage_invoices" ON public.invoices;
DROP POLICY IF EXISTS "authenticated_read_own_app_user" ON public.app_users;
DROP POLICY IF EXISTS "authenticated_landlord_read_app_users" ON public.app_users;
DROP POLICY IF EXISTS "authenticated_read_rooms" ON public.rooms;
DROP POLICY IF EXISTS "authenticated_insert_rooms" ON public.rooms;
DROP POLICY IF EXISTS "authenticated_landlord_update_rooms" ON public.rooms;
DROP POLICY IF EXISTS "authenticated_landlord_delete_rooms" ON public.rooms;
DROP POLICY IF EXISTS "authenticated_read_tenants" ON public.tenants;
DROP POLICY IF EXISTS "authenticated_insert_tenants" ON public.tenants;
DROP POLICY IF EXISTS "authenticated_landlord_update_tenants" ON public.tenants;
DROP POLICY IF EXISTS "authenticated_landlord_delete_tenants" ON public.tenants;
DROP POLICY IF EXISTS "authenticated_read_tenant_cccd_images" ON public.tenant_cccd_images;
DROP POLICY IF EXISTS "authenticated_insert_tenant_cccd_images" ON public.tenant_cccd_images;
DROP POLICY IF EXISTS "authenticated_landlord_update_tenant_cccd_images" ON public.tenant_cccd_images;
DROP POLICY IF EXISTS "authenticated_landlord_delete_tenant_cccd_images" ON public.tenant_cccd_images;
DROP POLICY IF EXISTS "authenticated_read_contracts" ON public.contracts;
DROP POLICY IF EXISTS "authenticated_insert_contracts" ON public.contracts;
DROP POLICY IF EXISTS "authenticated_landlord_update_contracts" ON public.contracts;
DROP POLICY IF EXISTS "authenticated_landlord_delete_contracts" ON public.contracts;
DROP POLICY IF EXISTS "authenticated_read_utility_metrics" ON public.utility_metrics;
DROP POLICY IF EXISTS "authenticated_insert_utility_metrics" ON public.utility_metrics;
DROP POLICY IF EXISTS "authenticated_landlord_update_utility_metrics" ON public.utility_metrics;
DROP POLICY IF EXISTS "authenticated_landlord_delete_utility_metrics" ON public.utility_metrics;
DROP POLICY IF EXISTS "authenticated_read_utility_pricing" ON public.utility_pricing;
DROP POLICY IF EXISTS "authenticated_landlord_insert_utility_pricing" ON public.utility_pricing;
DROP POLICY IF EXISTS "authenticated_landlord_update_utility_pricing" ON public.utility_pricing;
DROP POLICY IF EXISTS "authenticated_landlord_delete_utility_pricing" ON public.utility_pricing;
DROP POLICY IF EXISTS "authenticated_read_invoices" ON public.invoices;
DROP POLICY IF EXISTS "authenticated_insert_invoices" ON public.invoices;
DROP POLICY IF EXISTS "authenticated_landlord_update_invoices" ON public.invoices;
DROP POLICY IF EXISTS "authenticated_landlord_delete_invoices" ON public.invoices;

CREATE OR REPLACE FUNCTION public.current_app_user_is_active()
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
      AND status = 'active'
  );
$$;

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
      AND status = 'active'
  );
$$;

REVOKE ALL ON FUNCTION public.current_app_user_is_active() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_app_user_is_active() TO authenticated;

REVOKE ALL ON FUNCTION public.current_app_user_is_landlord() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_app_user_is_landlord() TO authenticated;

CREATE POLICY "authenticated_read_rooms"
ON public.rooms FOR SELECT TO authenticated
USING (public.current_app_user_is_active());

CREATE POLICY "authenticated_insert_rooms"
ON public.rooms FOR INSERT TO authenticated
WITH CHECK (public.current_app_user_is_active());

CREATE POLICY "authenticated_landlord_update_rooms"
ON public.rooms FOR UPDATE TO authenticated
USING (public.current_app_user_is_landlord())
WITH CHECK (public.current_app_user_is_landlord());

CREATE POLICY "authenticated_landlord_delete_rooms"
ON public.rooms FOR DELETE TO authenticated
USING (public.current_app_user_is_landlord());

CREATE POLICY "authenticated_read_tenants"
ON public.tenants FOR SELECT TO authenticated
USING (public.current_app_user_is_active());

CREATE POLICY "authenticated_insert_tenants"
ON public.tenants FOR INSERT TO authenticated
WITH CHECK (public.current_app_user_is_active());

CREATE POLICY "authenticated_landlord_update_tenants"
ON public.tenants FOR UPDATE TO authenticated
USING (public.current_app_user_is_landlord())
WITH CHECK (public.current_app_user_is_landlord());

CREATE POLICY "authenticated_landlord_delete_tenants"
ON public.tenants FOR DELETE TO authenticated
USING (public.current_app_user_is_landlord());

CREATE POLICY "authenticated_read_tenant_cccd_images"
ON public.tenant_cccd_images FOR SELECT TO authenticated
USING (public.current_app_user_is_active());

CREATE POLICY "authenticated_insert_tenant_cccd_images"
ON public.tenant_cccd_images FOR INSERT TO authenticated
WITH CHECK (public.current_app_user_is_active());

CREATE POLICY "authenticated_landlord_update_tenant_cccd_images"
ON public.tenant_cccd_images FOR UPDATE TO authenticated
USING (public.current_app_user_is_landlord())
WITH CHECK (public.current_app_user_is_landlord());

CREATE POLICY "authenticated_landlord_delete_tenant_cccd_images"
ON public.tenant_cccd_images FOR DELETE TO authenticated
USING (public.current_app_user_is_landlord());

CREATE POLICY "authenticated_read_contracts"
ON public.contracts FOR SELECT TO authenticated
USING (public.current_app_user_is_active());

CREATE POLICY "authenticated_insert_contracts"
ON public.contracts FOR INSERT TO authenticated
WITH CHECK (public.current_app_user_is_active());

CREATE POLICY "authenticated_landlord_update_contracts"
ON public.contracts FOR UPDATE TO authenticated
USING (public.current_app_user_is_landlord())
WITH CHECK (public.current_app_user_is_landlord());

CREATE POLICY "authenticated_landlord_delete_contracts"
ON public.contracts FOR DELETE TO authenticated
USING (public.current_app_user_is_landlord());

CREATE POLICY "authenticated_read_utility_metrics"
ON public.utility_metrics FOR SELECT TO authenticated
USING (public.current_app_user_is_active());

CREATE POLICY "authenticated_insert_utility_metrics"
ON public.utility_metrics FOR INSERT TO authenticated
WITH CHECK (public.current_app_user_is_active());

CREATE POLICY "authenticated_landlord_update_utility_metrics"
ON public.utility_metrics FOR UPDATE TO authenticated
USING (public.current_app_user_is_landlord())
WITH CHECK (public.current_app_user_is_landlord());

CREATE POLICY "authenticated_landlord_delete_utility_metrics"
ON public.utility_metrics FOR DELETE TO authenticated
USING (public.current_app_user_is_landlord());

CREATE POLICY "authenticated_read_utility_pricing"
ON public.utility_pricing FOR SELECT TO authenticated
USING (public.current_app_user_is_active());

CREATE POLICY "authenticated_landlord_insert_utility_pricing"
ON public.utility_pricing FOR INSERT TO authenticated
WITH CHECK (public.current_app_user_is_landlord());

CREATE POLICY "authenticated_landlord_update_utility_pricing"
ON public.utility_pricing FOR UPDATE TO authenticated
USING (public.current_app_user_is_landlord())
WITH CHECK (public.current_app_user_is_landlord());

CREATE POLICY "authenticated_landlord_delete_utility_pricing"
ON public.utility_pricing FOR DELETE TO authenticated
USING (public.current_app_user_is_landlord());

CREATE POLICY "authenticated_read_invoices"
ON public.invoices FOR SELECT TO authenticated
USING (public.current_app_user_is_active());

CREATE POLICY "authenticated_insert_invoices"
ON public.invoices FOR INSERT TO authenticated
WITH CHECK (public.current_app_user_is_active());

CREATE POLICY "authenticated_landlord_update_invoices"
ON public.invoices FOR UPDATE TO authenticated
USING (public.current_app_user_is_landlord())
WITH CHECK (public.current_app_user_is_landlord());

CREATE POLICY "authenticated_landlord_delete_invoices"
ON public.invoices FOR DELETE TO authenticated
USING (public.current_app_user_is_landlord());

CREATE POLICY "authenticated_read_own_app_user"
ON public.app_users FOR SELECT TO authenticated
USING (auth_user_id = auth.uid());

CREATE POLICY "authenticated_landlord_read_app_users"
ON public.app_users FOR SELECT TO authenticated
USING (public.current_app_user_is_landlord());
