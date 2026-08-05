# Client Data Architecture Convention

Operational management screens should render their page shell quickly, then load mutable business data through app-owned API routes. The goal is perceived speed for landlords and staff; SEO is not a priority for these authenticated screens.

## Standard flow

```text
Page shell / Client Component
        ↓
TanStack Query feature hook / screen state
        ↓
BFF API route under /api/...
        ↓
Application service / use case
        ↓
Repository interface
        ↓
InsForge adapter
```

## Rules for new or migrated slices

- UI must not call InsForge operational data adapters directly.
- Client components must use TanStack Query for browser API calls: `useQuery` for reads and `useMutation` for writes.
- `fetchAppApi` from `src/lib/api/client.ts` should be used inside TanStack Query `queryFn` or `mutationFn`, not through ad-hoc `useEffect` and `useState` request code.
- The app-level `QueryClientProvider` lives in `src/components/query-provider.tsx`.
- Mutations should invalidate or update the relevant query keys after successful writes.
- API routes return the shared `ApiResponse<T>` shape from `src/lib/api/response.ts`.
- API errors use the shared vocabulary in `src/lib/api/errors.ts`: `unauthorized`, `forbidden`, `validation`, `not_found`, `conflict`, and `internal`.
- Operational API routes resolve the signed-in Landlord or Staff user through `resolveOperationalAppUser` from `src/lib/server/operational-auth.ts`.
- Each route should create an API timer with `createApiTimer` from `src/lib/api/timing.ts` and measure at least `auth`, `service`, and repository or adapter spans as the slice is migrated.
- API route handlers should stay dynamic for operational data. Do not opt these endpoints into static caching.
- Each migrated screen must map TanStack Query states to loading, empty, error, retry, and success UI.
- Do not change business rules while migrating the data-loading architecture. Keep behavior equivalent unless the ticket explicitly asks otherwise.

## Foundation status

This foundation creates the shared contracts and helper modules only. It does not migrate Invoices, Room detail, Utility Metrics, Utility Pricing, Tenants, Contracts, Dashboard Reminders, or Auth/Staff Management screens yet.
