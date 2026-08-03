-- Prevent active or historical contracts from pointing to a Key Tenant that is
-- not assigned to the same Room.

CREATE UNIQUE INDEX IF NOT EXISTS contracts_one_active_per_room
ON public.contracts (room_id)
WHERE status = 'Active';

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
