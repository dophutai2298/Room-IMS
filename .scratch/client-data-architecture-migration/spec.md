Status: ready-for-agent

# Client Data Architecture Migration for Rental Operations

## Problem Statement

The Landlord is experiencing slow page appearances in the current Rental Room Management app. Important management pages such as the Invoice list and Room detail can take more than two or three seconds before the page appears because the current UI waits for server-side authentication checks and InsForge reads before rendering the main screen.

This is painful for a management system where operators expect the app shell to feel immediate. SEO is not important for these authenticated operational screens. The app should optimize for perceived performance, fast navigation, clear loading states, and a maintainable API structure rather than fully server-rendering every data screen before the user sees anything.

## Solution

Migrate operational screens to a client data architecture using vertical slices. Each screen should render a lightweight shell immediately, then load data through an authenticated backend-for-frontend API boundary. The UI must not call InsForge directly. Business rules should move behind application services and repository interfaces, with InsForge kept as an adapter implementation detail.

The migration should be incremental and safe: establish a small foundation first, then migrate one domain slice at a time. The first real slice should be Invoices because there is clear evidence that the current Invoice page is slow. Room detail should follow because it is also a proven hotspot.

## User Stories

1. As a Landlord, I want the app shell to appear quickly when I open an operational page, so that the app feels responsive even when data is still loading.
2. As a Staff member, I want tables and detail sections to show skeletons while data loads, so that I understand the app is working.
3. As a Landlord, I want page-level failures to show clear retryable errors, so that I can recover without refreshing blindly.
4. As a Staff member, I want empty states to explain what data is missing, so that I know what action to take next.
5. As a Landlord, I want all browser data reads to go through app API endpoints, so that backend details do not leak into the UI.
6. As a developer, I want UI components to depend on feature hooks rather than InsForge clients, so that UI implementation stays local to presentation and screen state.
7. As a developer, I want API endpoints to call application services, so that business operations have one clear entry point.
8. As a developer, I want services to depend on repository interfaces, so that InsForge remains replaceable and testable.
9. As a developer, I want InsForge table and schema knowledge isolated in adapters, so that schema changes have limited blast radius.
10. As a Landlord, I want the Invoice list to render its shell quickly, so that I can begin navigating and reading the page immediately.
11. As a Landlord, I want Invoice data to load after the shell with loading, empty, and error states, so that slow data does not block the whole screen.
12. As a Landlord, I want the Room detail page to show its main layout quickly, so that I do not wait several seconds before seeing the room context.
13. As a Staff member, I want Room detail sections to load independently where practical, so that one slow section does not hide the whole page.
14. As a Staff member, I want Utility Metrics reads and mutations to use the new API/service structure, so that monthly meter entry stays consistent with the new architecture.
15. As a Landlord, I want Invoice generation to remain correct after the architecture migration, so that performance work does not change billing rules.
16. As a Landlord, I want Utility Pricing management to use the same API/service structure, so that pricing behavior is consistent with Invoice generation.
17. As a Landlord, I want Tenant and Contract screens to migrate to the same pattern, so that all operations pages behave consistently.
18. As a Landlord, I want Dashboard and Reminder data to load in independent sections, so that dashboard cards can appear progressively.
19. As a developer, I want timing logs around API, auth, service, and repository work, so that future performance complaints can be attributed to the right seam.
20. As a developer, I want smoke tests or behavior tests for each migrated slice, so that the app remains safe while changing architecture.
21. As a Landlord, I want authentication and role resolution to remain enforced on every operational API, so that faster client loading does not weaken access control.
22. As a Staff member, I want the migration to preserve existing business behavior, so that daily workflows do not change unexpectedly.

## Implementation Decisions

- Use a vertical slice migration rather than a big-bang rewrite.
- Establish a small foundation before migrating screens. The foundation creates shared conventions and helpers but does not migrate major business behavior by itself.
- Use the following conceptual layering for migrated slices: UI shell and Client Component, feature hook and screen state, backend-for-frontend API boundary, application service or use case, repository interface, InsForge adapter.
- Keep InsForge access on the server side for business reads and mutations. The browser should not import InsForge data adapters for operational data.
- Client-side data loading is used to improve perceived performance. It is not assumed to reduce the real InsForge query duration by itself.
- Each migrated screen should render a useful shell immediately and move slow data behind loading boundaries.
- Every migrated slice must support loading, empty, error, and retry states where relevant.
- Each API boundary should return a consistent success or failure envelope.
- API errors should use a shared error vocabulary covering unauthorized, forbidden, validation, not found, conflict, and internal errors.
- Authentication and Landlord or Staff user resolution should be handled through a shared API auth helper.
- Application services should own business workflows such as Invoice generation, Utility Metrics persistence, Room detail read models, Tenant updates, Contract updates, and Utility Pricing changes.
- Repository interfaces should describe what the application needs in domain terms, not how InsForge tables are queried.
- InsForge adapters should be the only implementation layer that knows specific InsForge tables, query shapes, and backend error mapping.
- Prefer narrower list queries over broad all-column reads for migrated list screens.
- Add timing instrumentation around API total duration, auth resolution, service work, and repository/InsForge calls.
- Preserve existing Room, Tenant, Contract, Utility Metrics, Utility Pricing, Invoice, Landlord, Staff, and Key Tenant domain vocabulary.
- Preserve current business rules during the architecture migration unless a ticket explicitly says otherwise.
- The first migrated screen should be Invoices, followed by Room detail, Utility Metrics, Utility Pricing, Tenants, Contracts, Dashboard/Reminders, then Auth/Staff Management.

## Testing Decisions

- Tests should verify external behavior at the API and user-visible screen seams rather than implementation details.
- Each vertical slice should include a smoke test or behavior test for its main API operation.
- Each migrated screen should be checked for fast shell rendering with visible loading state before data arrives.
- Each migrated screen should be checked for successful data rendering, empty state, and error state.
- API tests should verify authentication enforcement and standardized error envelopes.
- Service tests should focus on business behavior only when behavior is difficult to verify through the API seam.
- Repository adapter tests should be limited to InsForge query mapping and error mapping where practical.
- Timing instrumentation should be manually verifiable in development logs for each migrated API.
- Existing billing behavior should be protected while migrating Invoice generation, Utility Metrics, and Utility Pricing.

## Out of Scope

- Replacing InsForge with a different backend.
- Public SEO optimization for authenticated management pages.
- Tenant self-service or public Tenant portal.
- New billing business rules beyond preserving existing Invoice, Utility Metrics, and Utility Pricing behavior.
- Full observability platform integration.
- Full role-based access control redesign beyond preserving Landlord and Staff enforcement.
- Large visual redesign beyond loading, empty, error, and progressive rendering states needed by the migration.
- Database schema changes unless a specific migrated slice needs a minimal compatibility change.

## Further Notes

The key decision is to improve perceived speed without letting implementation details leak upward. Client loading should be used as an interaction pattern, while the backend-for-frontend API keeps auth, business rules, and InsForge access centralized.

The safest implementation path is to make the change easy first: create the shared architecture foundation, then migrate one complete user-facing slice at a time.
