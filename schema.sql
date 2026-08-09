-- Rental Room MVP schema for InsForge/Postgres.
-- Source: original schema.sql tables for rooms, tenants, contracts,
-- utility_metrics, and invoices. Ticket 02 adds app_users, utility_pricing,
-- contract pricing overrides, invoice amount_paid constraints, safer RLS,
-- and deterministic MVP seed data.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Available'
        CHECK (status IN ('Available', 'Occupied', 'Maintenance')),
    base_price NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (base_price >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    date_of_birth TEXT,
    permanent_address TEXT,
    cccd_number TEXT,
    is_key_tenant BOOLEAN NOT NULL DEFAULT FALSE,
    cccd_front_url TEXT,
    cccd_back_url TEXT,
    status TEXT NOT NULL DEFAULT 'Active'
        CHECK (status IN ('Active', 'Moved Out')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS public.contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    key_tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    deposit_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (deposit_amount >= 0),
    rent_amount NUMERIC(12, 2) CHECK (rent_amount IS NULL OR rent_amount >= 0),
    electricity_price_override NUMERIC(12, 2)
        CHECK (electricity_price_override IS NULL OR electricity_price_override >= 0),
    water_price_override NUMERIC(12, 2)
        CHECK (water_price_override IS NULL OR water_price_override >= 0),
    start_date DATE NOT NULL,
    end_date DATE,
    status TEXT NOT NULL DEFAULT 'Active'
        CHECK (status IN ('Active', 'Terminated')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.utility_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    year INTEGER NOT NULL CHECK (year BETWEEN 2000 AND 2100),
    electricity_old NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (electricity_old >= 0),
    electricity_new NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (electricity_new >= electricity_old),
    water_old NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (water_old >= 0),
    water_new NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (water_new >= water_old),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(room_id, month, year)
);

CREATE TABLE IF NOT EXISTS public.utility_pricing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    effective_from DATE NOT NULL,
    electricity_unit_price NUMERIC(12, 2) NOT NULL CHECK (electricity_unit_price >= 0),
    water_unit_price NUMERIC(12, 2) NOT NULL CHECK (water_unit_price >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    year INTEGER NOT NULL CHECK (year BETWEEN 2000 AND 2100),
    electricity_fee NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (electricity_fee >= 0),
    water_fee NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (water_fee >= 0),
    room_fee NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (room_fee >= 0),
    other_fee NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (other_fee >= 0),
    other_fee_note TEXT,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
    status TEXT NOT NULL DEFAULT 'Unpaid'
        CHECK (status IN ('Unpaid', 'Partially Paid', 'Paid')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(room_id, month, year),
    CONSTRAINT invoices_amount_paid_not_more_than_total
        CHECK (amount_paid <= total_amount),
    CONSTRAINT invoices_status_matches_amount_paid
        CHECK (
            (status = 'Unpaid' AND amount_paid = 0)
            OR (status = 'Paid' AND amount_paid = total_amount)
            OR (status = 'Partially Paid' AND amount_paid > 0 AND amount_paid < total_amount)
        )
);

CREATE TABLE IF NOT EXISTS public.app_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('landlord', 'staff')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.contracts
    ADD COLUMN IF NOT EXISTS rent_amount NUMERIC(12, 2)
        CHECK (rent_amount IS NULL OR rent_amount >= 0),
    ADD COLUMN IF NOT EXISTS electricity_price_override NUMERIC(12, 2)
        CHECK (electricity_price_override IS NULL OR electricity_price_override >= 0),
    ADD COLUMN IF NOT EXISTS water_price_override NUMERIC(12, 2)
        CHECK (water_price_override IS NULL OR water_price_override >= 0);

ALTER TABLE public.invoices
    ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0
        CHECK (amount_paid >= 0);

ALTER TABLE public.invoices
    ADD COLUMN IF NOT EXISTS other_fee_note TEXT;

ALTER TABLE public.tenants
    ADD COLUMN IF NOT EXISTS date_of_birth TEXT,
    ADD COLUMN IF NOT EXISTS permanent_address TEXT,
    ADD COLUMN IF NOT EXISTS cccd_number TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'invoices_amount_paid_not_more_than_total'
    ) THEN
        ALTER TABLE public.invoices
            ADD CONSTRAINT invoices_amount_paid_not_more_than_total
            CHECK (amount_paid <= total_amount);
    END IF;

    UPDATE public.invoices
    SET status = CASE
        WHEN amount_paid = 0 THEN 'Unpaid'
        WHEN amount_paid = total_amount THEN 'Paid'
        ELSE 'Partially Paid'
    END;

    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'invoices_status_check'
    ) THEN
        ALTER TABLE public.invoices
            DROP CONSTRAINT invoices_status_check;
    END IF;

    ALTER TABLE public.invoices
        ADD CONSTRAINT invoices_status_check
        CHECK (status IN ('Unpaid', 'Partially Paid', 'Paid'));

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'invoices_status_matches_amount_paid'
    ) THEN
        ALTER TABLE public.invoices
            ADD CONSTRAINT invoices_status_matches_amount_paid
            CHECK (
                (status = 'Unpaid' AND amount_paid = 0)
                OR (status = 'Paid' AND amount_paid = total_amount)
                OR (status = 'Partially Paid' AND amount_paid > 0 AND amount_paid < total_amount)
            );
    END IF;
END $$;

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_cccd_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.utility_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.utility_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

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

CREATE POLICY "authenticated_manage_rooms"
ON public.rooms FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "authenticated_manage_tenants"
ON public.tenants FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

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

CREATE POLICY "authenticated_manage_contracts"
ON public.contracts FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "authenticated_manage_utility_metrics"
ON public.utility_metrics FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "authenticated_manage_utility_pricing"
ON public.utility_pricing FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "authenticated_manage_invoices"
ON public.invoices FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "authenticated_read_own_app_user"
ON public.app_users FOR SELECT TO authenticated
USING (auth_user_id = auth.uid());

INSERT INTO public.rooms (id, name, status, base_price)
VALUES
    ('00000000-0000-0000-0000-000000000101', 'Room 101', 'Occupied', 3200000),
    ('00000000-0000-0000-0000-000000000102', 'Room 102', 'Available', 2800000),
    ('00000000-0000-0000-0000-000000000103', 'Room 103', 'Occupied', 3500000)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    status = EXCLUDED.status,
    base_price = EXCLUDED.base_price,
    updated_at = NOW();

INSERT INTO public.tenants (
    id,
    room_id,
    full_name,
    phone,
    date_of_birth,
    permanent_address,
    cccd_number,
    is_key_tenant,
    status
)
VALUES
    (
        '10000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000101',
        'Nguyen Minh Khoa',
        '0908421739',
        '1998-02-22',
        'TP Ho Chi Minh',
        '079000000001',
        TRUE,
        'Active'
    ),
    (
        '10000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000101',
        'Tran Ngoc Mai',
        '0916284503',
        '1999-05-14',
        'Dong Nai',
        '079000000002',
        FALSE,
        'Active'
    )
ON CONFLICT (id) DO UPDATE
SET room_id = EXCLUDED.room_id,
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone,
    date_of_birth = EXCLUDED.date_of_birth,
    permanent_address = EXCLUDED.permanent_address,
    cccd_number = EXCLUDED.cccd_number,
    is_key_tenant = EXCLUDED.is_key_tenant,
    status = EXCLUDED.status,
    updated_at = NOW();

INSERT INTO public.contracts (
    id,
    room_id,
    key_tenant_id,
    deposit_amount,
    rent_amount,
    start_date,
    end_date,
    status
)
VALUES (
    '20000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000101',
    '10000000-0000-0000-0000-000000000001',
    3200000,
    3200000,
    '2026-01-01',
    NULL,
    'Active'
)
ON CONFLICT (id) DO UPDATE
SET room_id = EXCLUDED.room_id,
    key_tenant_id = EXCLUDED.key_tenant_id,
    deposit_amount = EXCLUDED.deposit_amount,
    rent_amount = EXCLUDED.rent_amount,
    start_date = EXCLUDED.start_date,
    end_date = EXCLUDED.end_date,
    status = EXCLUDED.status,
    updated_at = NOW();

INSERT INTO public.utility_pricing (
    id,
    effective_from,
    electricity_unit_price,
    water_unit_price,
    is_active
)
VALUES (
    '30000000-0000-0000-0000-000000000001',
    '2026-08-01',
    3900,
    18000,
    TRUE
)
ON CONFLICT (id) DO UPDATE
SET effective_from = EXCLUDED.effective_from,
    electricity_unit_price = EXCLUDED.electricity_unit_price,
    water_unit_price = EXCLUDED.water_unit_price,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

INSERT INTO public.utility_metrics (
    id,
    room_id,
    month,
    year,
    electricity_old,
    electricity_new,
    water_old,
    water_new
)
VALUES
    (
        '40000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000101',
        7,
        2026,
        980,
        1050,
        112,
        120
    ),
    (
        '40000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000101',
        8,
        2026,
        1050,
        1135,
        120,
        132
    )
ON CONFLICT (room_id, month, year) DO UPDATE
SET electricity_old = EXCLUDED.electricity_old,
    electricity_new = EXCLUDED.electricity_new,
    water_old = EXCLUDED.water_old,
    water_new = EXCLUDED.water_new,
    updated_at = NOW();

INSERT INTO public.invoices (
    id,
    room_id,
    month,
    year,
    electricity_fee,
    water_fee,
    room_fee,
    other_fee,
    other_fee_note,
    total_amount,
    amount_paid,
    status
)
VALUES (
    '50000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000101',
    8,
    2026,
    331500,
    216000,
    3200000,
    56000,
    'Phụ thu vệ sinh khu vực chung',
    3803500,
    1500000,
    'Partially Paid'
)
ON CONFLICT (room_id, month, year) DO UPDATE
SET electricity_fee = EXCLUDED.electricity_fee,
    water_fee = EXCLUDED.water_fee,
    room_fee = EXCLUDED.room_fee,
    other_fee = EXCLUDED.other_fee,
    other_fee_note = EXCLUDED.other_fee_note,
    total_amount = EXCLUDED.total_amount,
    amount_paid = EXCLUDED.amount_paid,
    status = EXCLUDED.status,
    updated_at = NOW();

CREATE UNIQUE INDEX IF NOT EXISTS contracts_one_active_per_room
ON public.contracts (room_id)
WHERE status = 'Active';

CREATE INDEX IF NOT EXISTS tenant_cccd_images_tenant_id_created_at_idx
ON public.tenant_cccd_images (tenant_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.enforce_contract_key_tenant_same_room()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM public.tenants
        WHERE tenants.id = NEW.key_tenant_id
          AND tenants.room_id = NEW.room_id
    ) THEN
        RAISE EXCEPTION 'Contract key_tenant_id must belong to the same room_id'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contracts_key_tenant_same_room ON public.contracts;

CREATE TRIGGER contracts_key_tenant_same_room
BEFORE INSERT OR UPDATE OF room_id, key_tenant_id
ON public.contracts
FOR EACH ROW
EXECUTE FUNCTION public.enforce_contract_key_tenant_same_room();

-- Create real InsForge auth users first, then map them to app roles:
-- INSERT INTO public.app_users (auth_user_id, email, display_name, role)
-- VALUES
--   ('<landlord-auth-user-id>', 'landlord@example.com', 'Landlord Demo', 'landlord'),
--   ('<staff-auth-user-id>', 'staff@example.com', 'Staff Demo', 'staff')
-- ON CONFLICT (auth_user_id) DO UPDATE
-- SET email = EXCLUDED.email,
--     display_name = EXCLUDED.display_name,
--     role = EXCLUDED.role,
--     updated_at = NOW();
