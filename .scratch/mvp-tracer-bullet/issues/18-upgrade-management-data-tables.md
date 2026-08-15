# 18 - Upgrade Management Data Tables

**What to build:** Management list screens use a consistent shadcn-style DataTable experience instead of one-off static tables or card-only lists. Users can search, filter, sort, paginate, hide/show columns, and recover from loading/error/empty states consistently across the main operational screens while keeping the current React Query client-data flow.

**Blocked by:** 06 - Track Invoice Payment Status; 08 - Manage Utility Pricing and Other Fee Notes; 09.1 - Enhance Tenant Profile and Directory Management; 10 - Contracts Client Data Management; 11 - Auth Staff Management Client Data; 12 - Rooms Client Data and Room Management.

**Status:** done

## Shared DataTable Requirements

- [x] A reusable DataTable pattern is added for management screens, aligned with the shadcn Data Table guide and powered by TanStack Table.
- [x] The implementation adds `@tanstack/react-table` if it is not already installed.
- [x] The shared table uses existing shadcn/ui primitives and preserves the current clay/light/dark visual language.
- [x] Columns can opt into sorting, filtering, visibility, and action cells without each screen reimplementing the table shell.
- [x] The component supports client-side pagination by default, with props or state shape that can later support manual/server-side pagination without rewriting the table consumers.

## Toolbar and Table Behavior

- [x] Each migrated table has a search input for its primary searchable text, such as invoice code/room, room name, tenant name, staff name/email, contract room/tenant, or utility pricing effective date/status.
- [x] Tables with status-like fields expose a compact status filter.
- [x] Users can open a column visibility dropdown to hide or show optional columns.
- [x] Users can sort supported columns by clicking the column header, with a visible ascending/descending/unsorted affordance.
- [x] Users can choose page size from 10, 20, and 50 rows.
- [x] Pagination controls show current page context, total filtered row count, and previous/next actions with disabled states when unavailable.
- [x] Row action menus/buttons remain available after migration and keep their existing create/edit/delete/view/payment workflows.
- [x] Export CSV is intentionally out of scope for this ticket.

## State Requirements

- [x] Loading states render table-shaped skeleton rows that match the active columns/page size closely enough to avoid large layout jumps.
- [x] Error states show a concise error panel with retry when the screen has a retry action.
- [x] Empty states distinguish between no data at all and no rows matching the current search/filter.
- [x] Background refetching keeps the existing rows visible and shows a subtle fetching indicator instead of flashing the whole table blank.
- [x] Search, filters, sorting, page size, and current page reset or preserve state in predictable ways when the underlying React Query data refreshes.

## Screen Migration Requirements

- [x] Invoices list uses the shared DataTable while preserving payment status update actions and invalidation behavior.
- [x] Rooms management uses the shared DataTable or a table/list toggle built on the shared DataTable, while preserving room create/update actions and dashboard invalidation behavior.
- [x] Tenants directory uses the shared DataTable while preserving search, create, edit, delete, detail, and CCCD image workflows.
- [x] Staff management uses the shared DataTable while preserving admin-only create and role/status display behavior.
- [x] Utility Pricing history uses the shared DataTable while preserving create, edit/supersede, active status, and effective-period behavior.
- [x] Contract management lists use the shared DataTable where a contract list already exists. If no standalone Contracts page exists at implementation time, do not create a new global Contracts feature just for this ticket; migrate the existing room-scoped contract list experience instead.

## Data Architecture Requirements

- [x] Migrated screens continue to read data through the existing authenticated app APIs and TanStack Query `useQuery`.
- [x] Table interactions are client-side for this ticket; no API query params for server-side search, sorting, filtering, or pagination are required.
- [x] Mutations continue to use existing `useMutation` flows and invalidate the same query keys as before.
- [x] No existing API response contract is changed just to support the table upgrade.

## Verification

- [x] Behavior or smoke coverage verifies the shared table state model for search, sort, status filter, column visibility, pagination, loading, empty, filtered-empty, error, retry, and background fetching.
- [x] At least one migrated screen has coverage proving row actions still call the existing workflow after the DataTable migration.
- [x] Typecheck, lint, and the existing test suite pass.

## Implementation Notes

- The shadcn Data Table documentation treats DataTable as a pattern built from TanStack Table and shadcn Table primitives, not as a single universal component to copy blindly.
- Because this app has multiple management lists, this ticket should extract a reusable table shell and let each screen own its domain-specific columns and row actions.
- Keep this as a client-side UX upgrade. Server-side table operations should be handled by a later ticket only when real data volume makes them necessary.

## Implementation Notes - Completed

- Added a shared `DataTable` shell using TanStack Table v9, existing shadcn/ui table primitives, Radix Dropdown Menu column visibility, clay styling, Vietnamese default labels, and future manual-pagination props.
- Migrated the existing management lists: `/invoices`, `/rooms`, `/tenants`, `/staff`, `/utility-pricing`, and the room-scoped contract history list.
- Kept all reads/mutations on the existing app APIs and React Query flows; table search/filter/sort/pagination/column visibility are client-side only.
- Utility Pricing preserved the existing create/supersede/deactivate flow. This ticket did not introduce a brand-new edit form because no standalone edit flow existed before the table migration.
- Added behavior coverage for DataTable states, TanStack table interactions, out-of-range page reset on refreshed data, and invoice row action targets.

## Verification - Completed

- `npx.cmd tsc --noEmit`
- `npm.cmd run lint`
- `npm.cmd test` — 34 passing tests.
