# 04 — Record Monthly Utility Metrics

**What to build:** Allow a Staff or Landlord user to enter monthly electricity and water readings for a real InsForge-backed Room, calculate consumption, validate impossible readings, and persist one Utility Metrics record per Room and billing period.

**Blocked by:** 03 — Persist Room, Tenant, and Contract Data.

**Status:** ready-for-agent

- [ ] The Utility Metrics screen displays old electricity and water readings for the selected Room and billing period.
- [ ] The Utility Metrics screen uses Tailwind/shadcn form controls and inline validation.
- [ ] New electricity and water readings can be entered and saved.
- [ ] Consumption is calculated as new reading minus old reading.
- [ ] The app rejects readings where the new value is lower than the old value.
- [ ] Saving the same Room and billing period updates the existing record rather than creating a duplicate.
- [ ] Saving and error feedback is visible without losing entered values.
- [ ] Saved Utility Metrics remain visible after refresh.
