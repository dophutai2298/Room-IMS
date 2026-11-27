-- The verified InsForge snapshot contains older invoices with no discount column value.
-- Preserve those historical NULLs rather than rewriting them as zero during migration.
alter table public.invoices alter column discount_amount drop not null;
