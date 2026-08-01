-- Cấu trúc cơ sở dữ liệu cho dự án Quản lý Phòng Trọ (Room Management)

-- 1. Bảng rooms (Danh sách phòng)
CREATE TABLE IF NOT EXISTS public.rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Trống', -- Trống, Đang thuê, Bảo trì
    base_price NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Bảng tenants (Cư dân)
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    is_key_tenant BOOLEAN NOT NULL DEFAULT FALSE,
    cccd_front_url TEXT,
    cccd_back_url TEXT,
    status TEXT NOT NULL DEFAULT 'Đang ở', -- Đang ở, Đã chuyển đi
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Bảng contracts (Hợp đồng)
CREATE TABLE IF NOT EXISTS public.contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE,
    key_tenant_id UUID REFERENCES public.tenants(id) ON DELETE RESTRICT,
    deposit_amount NUMERIC NOT NULL DEFAULT 0,
    start_date DATE NOT NULL,
    end_date DATE,
    status TEXT NOT NULL DEFAULT 'Hiệu lực', -- Hiệu lực, Đã thanh lý
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Bảng utility_metrics (Chỉ số điện nước)
CREATE TABLE IF NOT EXISTS public.utility_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    electricity_old NUMERIC NOT NULL DEFAULT 0,
    electricity_new NUMERIC NOT NULL DEFAULT 0,
    water_old NUMERIC NOT NULL DEFAULT 0,
    water_new NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(room_id, month, year)
);

-- 5. Bảng invoices (Hóa đơn)
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    electricity_fee NUMERIC NOT NULL DEFAULT 0,
    water_fee NUMERIC NOT NULL DEFAULT 0,
    room_fee NUMERIC NOT NULL DEFAULT 0,
    other_fee NUMERIC NOT NULL DEFAULT 0,
    total_amount NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Chưa thanh toán', -- Chưa thanh toán, Thanh toán 1 phần, Đã thanh toán
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(room_id, month, year)
);

-- Thiết lập Row Level Security (RLS) cơ bản để cho phép tất cả các thao tác (vì dự án đang ở giai đoạn MVP)
-- Nếu sau này cần phân quyền, sẽ sửa lại các policy này.
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.utility_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Tạo policy cho phép truy cập đầy đủ
CREATE POLICY "Cho phép tất cả trên rooms" ON public.rooms FOR ALL USING (true);
CREATE POLICY "Cho phép tất cả trên tenants" ON public.tenants FOR ALL USING (true);
CREATE POLICY "Cho phép tất cả trên contracts" ON public.contracts FOR ALL USING (true);
CREATE POLICY "Cho phép tất cả trên utility_metrics" ON public.utility_metrics FOR ALL USING (true);
CREATE POLICY "Cho phép tất cả trên invoices" ON public.invoices FOR ALL USING (true);
