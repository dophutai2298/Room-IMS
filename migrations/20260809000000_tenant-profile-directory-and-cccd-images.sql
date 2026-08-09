-- Ticket 09.1: Tenant profile fields, global Tenant directory, and multiple CCCD images.

ALTER TABLE public.tenants
    ADD COLUMN IF NOT EXISTS date_of_birth TEXT,
    ADD COLUMN IF NOT EXISTS permanent_address TEXT,
    ADD COLUMN IF NOT EXISTS cccd_number TEXT;

CREATE TABLE IF NOT EXISTS public.tenant_cccd_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    storage_key TEXT NOT NULL,
    public_url TEXT NOT NULL,
    file_name TEXT,
    mime_type TEXT,
    file_size BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.tenant_cccd_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_manage_tenant_cccd_images" ON public.tenant_cccd_images;

CREATE POLICY "authenticated_manage_tenant_cccd_images"
ON public.tenant_cccd_images FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.app_users
        WHERE app_users.auth_user_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.app_users
        WHERE app_users.auth_user_id = auth.uid()
    )
);

CREATE INDEX IF NOT EXISTS tenant_cccd_images_tenant_id_created_at_idx
ON public.tenant_cccd_images (tenant_id, created_at DESC);

UPDATE public.tenants
SET cccd_number = COALESCE(cccd_number, '079000000001')
WHERE id = '10000000-0000-0000-0000-000000000001';

UPDATE public.tenants
SET cccd_number = COALESCE(cccd_number, '079000000002')
WHERE id = '10000000-0000-0000-0000-000000000002';
