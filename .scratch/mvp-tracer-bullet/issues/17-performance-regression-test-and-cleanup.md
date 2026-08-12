# 17 - Performance Regression Test and Cleanup

**What to build:** The performance work ends with repeatable proof and clean observability. Developers can rerun the original slow scenarios, compare before/after latency, and keep only bounded diagnostics that are safe for ongoing development.

**Blocked by:** 15 - Optimize Operational Authentication; 16 - Optimize InsForge API Critical Path.

**Status:** ready-for-agent

- [ ] The original slow scenarios are rerun, including Invoices list, Room detail, Dashboard, Tenant directory/detail, Utility Metrics, and Invoice generation.
- [ ] Regression output compares before and after p50, p95, min, max, status, and sample count for each representative endpoint.
- [ ] API contract and behavior smoke tests confirm response semantics, auth behavior, loading states, and retry/error states still work after performance changes.
- [ ] Temporary noisy diagnostic logs are removed, downgraded, or replaced with bounded production-safe observability.
- [ ] The final performance note explains where the bottleneck moved after optimization and whether any remaining latency is expected network/InsForge time.
- [ ] The parent performance issue remains open or is updated separately only when the user explicitly asks for issue-status changes.
