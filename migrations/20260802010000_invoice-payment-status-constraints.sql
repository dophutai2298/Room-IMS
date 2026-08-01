-- Tighten invoice status semantics after the foundation migration.

UPDATE public.invoices
SET status = CASE
    WHEN amount_paid = 0 THEN 'Unpaid'
    WHEN amount_paid = total_amount THEN 'Paid'
    ELSE 'Partially Paid'
END;

ALTER TABLE public.invoices
    DROP CONSTRAINT IF EXISTS invoices_status_check;

ALTER TABLE public.invoices
    ADD CONSTRAINT invoices_status_check
    CHECK (status IN ('Unpaid', 'Partially Paid', 'Paid'));

DO $$
BEGIN
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
