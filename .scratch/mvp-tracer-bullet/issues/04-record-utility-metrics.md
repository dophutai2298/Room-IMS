# 04 — Record Monthly Utility Metrics

**What to build:** Allow a Staff or Landlord user to enter monthly electricity and water readings for a real InsForge-backed Room, calculate consumption, validate impossible readings, and persist one Utility Metrics record per Room and billing period.

**Blocked by:** 03 — Persist Room, Tenant, and Contract Data.

**Status:** human-review

**MVP business scope:** done.

**Client Data Architecture follow-up:** human-review. Folded in from `client-data-architecture-migration/issues/04-utility-metrics-client-data-slice.md`.

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

## Client Data Architecture Follow-up

**Blocked by:** 03 — Persist Room, Tenant, and Contract Data; 05 — Generate Invoices From Utility Metrics; Room Detail client-data migration already completed in the former client-data tracker.

- [x] Utility Metrics reads use TanStack Query `useQuery` with stable Room and billing-period query keys.
- [x] Utility Metrics saves use TanStack Query `useMutation`.
- [x] Successful saves invalidate or update affected Utility Metrics, Room detail, and Invoice query keys.
- [x] Utility Metrics screens load existing readings through an authenticated app API.
- [x] Saving Utility Metrics uses an application service and repository interface before reaching the InsForge adapter.
- [x] The UI supports loading, validation, saving, success, empty, error, and retry states.
- [x] Electricity and water consumption continue to be calculated from new readings minus previous readings.
- [x] Negative consumption remains blocked with user-visible validation.
- [x] Utility Metrics remain unique per Room and billing period.
- [x] The mutation response uses the standard API success or failure shape.
- [x] API timing logs identify auth, validation, service, and InsForge write duration.
- [x] A smoke test or behavior test verifies saving valid metrics and rejecting invalid lower readings.
