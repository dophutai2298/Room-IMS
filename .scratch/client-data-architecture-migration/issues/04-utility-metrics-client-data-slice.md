# 04 — Utility Metrics Client Data Slice

**What to build:** Move Utility Metrics reading and saving into the new API/service/repository structure while preserving the monthly meter-entry workflow.

**Blocked by:** 01 — Client Data Architecture Foundation; 03 — Room Detail Client Data Slice; MVP 04 — Record Monthly Utility Metrics.

**Status:** ready-for-agent

- [ ] Utility Metrics screens load existing readings through an authenticated app API.
- [ ] Saving Utility Metrics uses an application service and repository interface before reaching the InsForge adapter.
- [ ] The UI supports loading, validation, saving, success, empty, error, and retry states.
- [ ] Electricity and water consumption continue to be calculated from new readings minus previous readings.
- [ ] Negative consumption remains blocked with user-visible validation.
- [ ] Utility Metrics remain unique per Room and billing period.
- [ ] The mutation response uses the standard API success or failure shape.
- [ ] API timing logs identify auth, validation, service, and InsForge write duration.
- [ ] A smoke test or behavior test verifies saving valid metrics and rejecting invalid lower readings.
