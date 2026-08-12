# 16 - Optimize InsForge API Critical Path

**What to build:** The slowest measured InsForge-backed API paths are improved using the evidence from the baseline. Query count, request fan-out, SDK retry behavior, and database access are changed only where timing proves they dominate the user-visible delay.

**Blocked by:** 15 - Optimize Operational Authentication.

**Status:** ready-for-agent

- [ ] The slowest remaining representative endpoints are ranked using the tracing and baseline data from ticket 14 after ticket 15 is complete.
- [ ] Any repeated read, page-level fan-out, or multi-query repository path is kept parallel where appropriate and consolidated only when the measured critical path justifies it.
- [ ] Dashboard and Room-detail API usage is reviewed for repeated Auth and duplicate domain reads, with any aggregation preserving existing independent loading and retry behavior where that still benefits the UI.
- [ ] SDK retry or timeout behavior is changed only if trace evidence shows retry/backoff is causing the observed delay, and expected failure behavior is documented.
- [ ] Database indexes, query shape changes, or query-plan work are added only for filters or sorts proven slow by InsForge/database evidence.
- [ ] Changes preserve the current service, repository, and InsForge adapter boundaries unless the trace proves a boundary is causing material latency.
- [ ] Before/after data shows the optimized endpoints are faster without changing successful response semantics or error shape.
