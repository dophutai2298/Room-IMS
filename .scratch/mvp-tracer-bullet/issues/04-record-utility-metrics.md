# 04 — Record Monthly Utility Metrics

**What to build:** Allow a Staff or Landlord user to enter monthly electricity and water readings for a real InsForge-backed Room, calculate consumption, validate impossible readings, and persist one Utility Metrics record per Room and billing period.

**Blocked by:** 03 — Persist Room, Tenant, and Contract Data.

**Status:** human-review

- [x] The Utility Metrics screen displays old electricity and water readings for the selected Room and billing period.
- [x] The Utility Metrics screen uses Tailwind/shadcn form controls and inline validation.
- [x] New electricity and water readings can be entered and saved.
- [x] Consumption is calculated as new reading minus old reading.
- [x] The app rejects readings where the new value is lower than the old value.
- [x] Saving the same Room and billing period updates the existing record rather than creating a duplicate.
- [x] Saving and error feedback is visible without losing entered values.
- [x] Saved Utility Metrics remain visible after refresh.

## Implementation notes

- `/rooms/[id]/utilities` now reads the selected billing period from `?month=&year=`, defaulting to the current server month/year.
- Old readings come from the existing Utility Metrics row for the selected period when present; otherwise they come from the latest prior period for the same Room, falling back to `0`.
- Saving is idempotent at the app layer: existing `(room_id, month, year)` rows are updated; missing rows are inserted. The DB unique constraint from ticket 02 remains the final duplicate guard.
- If a concurrent insert wins the same `(room_id, month, year)` race first, the save path re-reads that period and updates the existing row.
- Validation runs in both the client form and the server repository before writing to InsForge.
