-- Preserve the reason for ad-hoc Invoice charges without changing existing rows.

ALTER TABLE public.invoices
    ADD COLUMN IF NOT EXISTS other_fee_note TEXT;
