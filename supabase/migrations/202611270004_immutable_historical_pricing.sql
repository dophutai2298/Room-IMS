-- Historical unit prices are append-only. Operational updates only deactivate/supersede rows.
revoke update (electricity_unit_price, water_unit_price) on public.utility_pricing from authenticated;
