Status: ready-for-agent

# MVP Tracer Bullet: InsForge-Backed Rental Operations Flow With UI Redesign

## Problem Statement

The Landlord currently has static screens that describe the Rental Room Management workflow, but the app does not yet support a real end-to-end operations cycle. A Landlord or Staff member cannot authenticate through InsForge, add Tenants to a Room through InsForge, identify the Key Tenant, record monthly Utility Metrics, generate an Invoice from actual consumption and Utility Pricing, or mark the Invoice as paid.

The current UI also reads as an early mock rather than a production operations tool. It lacks trend charts for operational statistics, a user-selectable light/dark theme, realistic loading/empty/error states, and a distinctive visual system for repeated daily work. This prevents the product from replacing spreadsheet-based monthly operations, which is the stated MVP goal.

## Solution

Build the first vertical MVP slice for a single property on top of InsForge: authenticate Landlord and Staff users, manage Rooms and Tenants, record a Contract with one Key Tenant, enter monthly Utility Metrics, automatically generate an Invoice, and record payment status.

Redesign the UI at the same time using Next.js, Tailwind CSS v4, and shadcn/ui. The interface should be a data-first rental operations dashboard with restrained claymorphism: soft dimensional surfaces, consistent lighting and shadows, clear hierarchy, compact but readable density, strong form states, useful tables, and no marketing-style decoration. The dashboard should include responsive trend charts and support light, dark, and system themes.

The slice should favor a complete working path over broad administration features. Static mock data should be replaced with InsForge-backed data where needed for the core flow, while keeping the current domain vocabulary.

## Implementation Order

1. Establish the Tailwind/shadcn UI foundation first. This phase may keep or introduce local mock/demo data so the redesigned screens are visible immediately.
2. Set up InsForge DB, authentication, app user roles, seed data, and the app-facing InsForge adapter/API boundary.
3. Replace mock/demo data feature by feature: Rooms/Tenants/Contracts, Utility Metrics, Invoice generation, Invoice payment status, then dashboard reminders.
4. Treat InsForge foundation as a blocker for real-data feature tickets, while the UI foundation remains safe to implement before backend wiring.

## User Stories

1. As a Landlord, I want to see all Rooms with their current Room Status, so that I can quickly understand availability.
2. As a Landlord, I want to sign in through InsForge authentication, so that rental operations data is not publicly editable.
3. As a Staff member, I want to sign in through InsForge authentication, so that my operational actions can be associated with a real user.
4. As a Landlord, I want Staff users to have an explicit role, so that later permission rules can distinguish Staff from Landlord.
5. As a Landlord, I want Room Status to reflect active Contracts and maintenance overrides, so that I do not manually reconcile status labels.
6. As a Landlord, I want to create a Room with a name and base rent, so that I can onboard rental units into the system.
7. As a Landlord, I want to update Room information, so that rent or maintenance state stays accurate.
8. As a Landlord, I want to open a Room detail view, so that I can manage the operational data for that Room.
9. As a Landlord, I want to add multiple Tenants to a Room, so that shared rooms are represented accurately.
10. As a Landlord, I want to mark exactly one Tenant as the Key Tenant for a Contract, so that billing and contact responsibility are clear.
11. As a Landlord, I want to store Tenant identity and contact details, so that the Room record can support legal and operational needs.
12. As a Landlord, I want to attach front and back identity-card image URLs to a Tenant, so that Tenant records can reference required documents.
13. As a Staff member, I want to see the previous Utility Metrics for a Room and billing period, so that I can enter the new readings correctly.
14. As a Staff member, I want to enter electricity and water readings for the current billing period, so that monthly usage can be calculated.
15. As a Staff member, I want the app to calculate utility consumption from old and new readings, so that I do not do manual math.
16. As a Staff member, I want the app to block or warn when a new reading is lower than the old reading, so that billing errors are caught before Invoice generation.
17. As a Landlord, I want Utility Pricing to be applied when generating an Invoice, so that electricity and water charges are calculated consistently.
18. As a Landlord, I want Contract-level Utility Pricing overrides to be supported, so that special agreements can be billed correctly.
19. As a Landlord, I want an Invoice to combine base rent, electricity fee, water fee, and other fees, so that the final amount is complete.
20. As a Landlord, I want Invoice generation to be idempotent per Room and billing period, so that accidental duplicate invoices are avoided.
21. As a Landlord, I want to see all Invoices with payment status, so that collections work can be prioritized.
22. As a Landlord, I want to record the amount received and mark an Invoice as unpaid, partially paid, or paid, so that debt tracking and collected-revenue statistics are accurate.
23. As a Landlord, I want dashboard reminders to highlight Rooms missing Utility Metrics and unpaid Invoices, so that monthly work is easy to follow.
24. As a Staff member, I want validation errors to appear close to the fields I am editing, so that I can correct input quickly.
25. As a Landlord, I want the app to preserve existing Room, Tenant, Utility Metrics, and Invoice data across page reloads, so that the app can replace spreadsheets for the MVP flow.
26. As a Landlord, I want the app UI to feel like a focused operations dashboard, so that monthly room management work is easier to scan and complete.
27. As a Staff member, I want consistent form controls, tables, dialogs, badges, skeletons, and feedback messages, so that every task feels predictable.
28. As a Landlord, I want loading, empty, error, validation, saving, and success states across the flow, so that I understand what the system is doing.
29. As a Staff member, I want the UI to work well on desktop and mobile, so that I can update Utility Metrics in the field.
30. As a Landlord, I want to see revenue billed versus revenue collected over time, so that I can identify collection trends without exporting a spreadsheet.
31. As a Landlord or Staff member, I want to choose light, dark, or system appearance and retain that preference, so that the dashboard remains comfortable in different working environments.
32. As a Landlord, I want the dashboard to have a distinctive but restrained claymorphism style, so that important operational surfaces feel organized without reducing data readability.

## Implementation Decisions

- Use the existing domain terms: Landlord, Staff, Tenant, Key Tenant, Room, Room Status, Contract, Utility Metrics, Utility Pricing, and Invoice.
- InsForge is the backend, authentication, and persistence layer for this MVP slice. Use the existing InsForge project configuration as the source of backend connection details.
- Apply the existing database schema as the starting point for InsForge DB setup: Rooms, Tenants, Contracts, Utility Metrics, and Invoices.
- Extend the DB foundation only where the MVP requires it: app user profiles/roles for Landlord and Staff, global Utility Pricing, and Contract-level Utility Pricing overrides if those are not already represented.
- Create a single app-facing InsForge adapter/API boundary for auth, database reads/writes, and error mapping so page code does not directly scatter backend calls.
- Use InsForge authentication for sign-in, sign-out, session lookup, and route protection of operational screens.
- Keep role enforcement simple in the MVP: Landlord and Staff roles are recorded and surfaced, while fine-grained permission rules can remain minimal unless needed by the flow.
- Keep the current Next.js App Router application shape, replacing static page arrays with InsForge data access at the highest practical boundary.
- Add Tailwind CSS v4 using the documented PostCSS setup and global CSS import.
- Initialize shadcn/ui for the existing Next.js project and use CSS variables for theming.
- Use shadcn/ui as the component foundation for Button, Input, Label, Card, Badge, Table, Dialog, Select, Textarea, Separator, Skeleton, and Sonner.
- Customize the shadcn theme and composed components so the UI does not look like the default shadcn starter.
- The visual direction is a restrained claymorphism operational dashboard: softly raised containers, shallow inset controls, a consistent upper-left light source, tinted shadows, one practical emerald accent, and no decorative landing-page patterns.
- Use a floating top navigation rather than a permanent desktop sidebar for the current three-route information architecture; preserve all route slugs and active-route feedback.
- Support light, dark, and system themes. Persist the user's choice locally, respect system preference, and avoid a flash of the wrong theme during hydration.
- Use self-hosted Geist Sans and Geist Mono so typography and tabular figures remain consistent without runtime font requests.
- Add a responsive six-month revenue chart comparing billed amount with collected amount. Chart data may remain mock data until the dashboard real-data ticket is implemented.
- Charts must expose a text alternative/accessibility layer, adapt to mobile widths, use theme tokens rather than fixed light-only colors, and provide readable tooltips.
- Prefer Server Components by default. Isolate Client Components for form interactivity, optimistic states, dialogs, toasts, and other browser-only behavior.
- Treat the MVP as a vertical slice: Room list, Room detail, Utility Metrics entry, Invoice generation, and Invoice payment status must work together before adding broad reporting features.
- Room Status is computed as Occupied when a Room has an active Contract, Available when it does not, and Maintenance when the Room maintenance override is set.
- A Contract must reference a Room and a Key Tenant. The Key Tenant must belong to the same Room.
- A Room can have many Tenants, but only one active Key Tenant should be used for the active Contract.
- Utility Metrics are unique for a Room and billing period.
- Electricity and water consumption are calculated as new reading minus old reading.
- Utility Metrics entry must reject negative consumption. Sudden consumption changes can be introduced as a warning after the blocking validation is in place.
- Utility Pricing should exist globally for the property and allow Contract-level overrides. If persistence for Utility Pricing is not already present, add the minimum schema needed for the MVP.
- Invoice generation should create or update one Invoice per Room and billing period rather than creating duplicates.
- Invoice totals are calculated from Contract base rent, electricity usage, water usage, applicable Utility Pricing, and optional other fees.
- Invoice payment status uses the existing status vocabulary: unpaid, partially paid, and paid.
- Each Invoice stores `amount_paid`. Unpaid means `amount_paid = 0`, paid means `amount_paid = total_amount`, and partially paid requires `0 < amount_paid < total_amount`.
- Revenue charts aggregate `total_amount` as billed revenue and `amount_paid` as collected revenue by billing period; do not infer collected revenue from status alone.
- Keep identity-card images as URLs for this slice. Upload/storage workflows are out of scope.
- Fine-grained permission enforcement is not the focus of the first slice, but InsForge authentication and basic Landlord/Staff role records are in scope.

## Testing Decisions

- Prefer one high-level behavior seam for the full monthly workflow: create or load a Room with Tenants and an active Contract, enter Utility Metrics, generate an Invoice, then update payment status and verify the user-visible result.
- Tests should assert external behavior and persisted outcomes, not component internals.
- InsForge integration tests should verify authentication state, persisted records, and user-visible outcomes at the application boundary.
- UI tests should cover loading, empty, error, validation, saving, and success states for the core flow.
- UI checks should verify light, dark, and system theme selection, persisted preference after reload, and hydration without visible theme mismatch.
- Dashboard checks should verify that the revenue chart renders from mock data, remains readable at mobile and desktop widths, and maps billed/collected series correctly.
- Add focused validation coverage for Utility Metrics: consumption calculation, lower-than-previous-reading rejection, and one metric record per Room per billing period.
- Add focused Invoice calculation coverage: base rent plus electricity fee plus water fee plus other fees, using applicable Utility Pricing.
- Add idempotency coverage for Invoice generation to ensure repeated generation for the same Room and period does not create duplicate Invoices.
- Add payment consistency coverage so `amount_paid` cannot be negative or exceed `total_amount`, and status remains consistent with the recorded amount.
- Use existing page-level routes as the main testing seam when possible. Introduce lower-level unit tests only for pure calculation or validation rules that would otherwise be hard to exercise through the user flow.
- Prior art in the codebase is currently limited; establish the first test pattern for this MVP slice and keep it documented through readable test names.

## Out of Scope

- Tenant self-service portal.
- Real identity-card image upload and storage.
- OCR for identity-card data extraction.
- Dynamic QR payment or bank reconciliation.
- Zalo ZNS, SMS, or email notifications.
- Multi-property or multi-landlord support.
- Full role-based access control beyond basic Landlord/Staff role recording.
- Audit log for every sensitive action.
- Advanced anomaly detection for Utility Metrics beyond basic invalid-reading validation.
- Contract renewal and liquidation workflows beyond the active Contract needed for the MVP slice.
- Advanced analytics, custom chart builders, date-range comparison, and exportable reports beyond the six-month revenue trend.
- Full design-system documentation site. The task is to establish the app UI foundation and redesigned MVP surfaces.

## Further Notes

The current app already presents the intended navigation and screens, but the data is static and the UI needs a stronger product foundation. The first implementation should preserve the core user-facing flow while making it real: a Landlord signs in, starts from Rooms, manages Tenants and a Contract, enters Utility Metrics, generates an Invoice, and then tracks payment.

The preferred test seam is the full workflow because this product's value is the connected monthly operation, not an isolated form.
