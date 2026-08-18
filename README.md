# Rental Room 201

Rental Room 201 is an authenticated rental-room management MVP for landlords and staff. It focuses on day-to-day operations: rooms, tenants, contracts, utility metrics, invoices, payment status, dashboard reminders, staff access, and password reset.

The app is a management system, not a SEO-first public site. Pages render an app shell and load mutable operational data through Next.js API routes with TanStack Query.

## Key Features

- Clay-style dashboard with light/dark mode, charts, room availability, unpaid invoices, and missing utility metric reminders.
- InsForge-backed authentication, password reset OTP, and app role mapping for `landlord` and `staff`.
- Role policy for operational APIs: Landlord can update/delete/administer; Staff can read and create where allowed.
- Client data architecture with `@tanstack/react-query` for reads, writes, invalidation, loading, error, retry, and saving states.
- Reusable TanStack-powered management data table foundation.
- Room list, create, update, maintenance status, and room detail workflows.
- Tenant directory and room tenant management with profile fields, CCCD number, and CCCD image upload/delete.
- Contract management for room contracts and key tenant context.
- Monthly electricity/water metric entry and invoice generation.
- Utility pricing management with effective periods.
- Invoice list, payment status tracking, and amount paid updates.
- Staff/admin management APIs and UI foundation.
- Shared API response, error, auth, permission, and timing helpers.

## Tech Stack

| Area | Technology |
| --- | --- |
| Framework | Next.js `16.2.12` App Router |
| UI | React `19`, Tailwind CSS `4`, shadcn/ui, Radix UI |
| Client data | `@tanstack/react-query` |
| Tables | `@tanstack/react-table` |
| Backend/BFF | Next.js route handlers under `src/app/api` |
| Data/Auth provider | InsForge SDK |
| Charts | Recharts |
| Theme | `next-themes` |
| Language | TypeScript |
| Package manager | npm |

## Prerequisites

- Node.js 20+
- npm
- An InsForge project
- InsForge database migrations applied from this repo
- At least one InsForge auth user mapped to `public.app_users`

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create `.env` from `.env.example` and fill in your InsForge values:

```bash
cp .env.example .env
```

Required variables:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_INSFORGE_URL` | Public InsForge project URL. |
| `NEXT_PUBLIC_INSFORGE_ANON_KEY` | Public anonymous key used by browser/server clients. |
| `INSFORGE_API_KEY` | Server-only project API key for privileged backend operations. |
| `NEXT_PUBLIC_APP_URL` | App URL for local auth redirects, usually `http://localhost:3000`. |

Optional variables for API timing/performance checks are documented in [.env.example](.env.example).

### 3. Apply InsForge migrations

The authoritative schema is [schema.sql](schema.sql). Versioned migrations live in [migrations](migrations).

```bash
npx @insforge/cli db migrations up --all
npx @insforge/cli db migrations list
```

Note: the InsForge CLI expects migration filenames in `<version>_<name>.sql` format. If the CLI rejects metadata files in `migrations`, temporarily move non-SQL files out, run the migration, then restore them.

### 4. Create/login app users

Public registration is intentionally disabled. Accounts should be created through the trusted InsForge/Admin path, then mapped to an app role in `public.app_users`.

Example role mapping:

```sql
INSERT INTO public.app_users (auth_user_id, email, display_name, role)
VALUES
  ('<insforge-auth-user-id>', 'landlord@example.com', 'Landlord Demo', 'landlord')
ON CONFLICT (auth_user_id) DO UPDATE
SET email = EXCLUDED.email,
    display_name = EXCLUDED.display_name,
    role = EXCLUDED.role,
    updated_at = NOW();
```

Supported roles:

- `landlord`
- `staff`

### 5. Start the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## App Routes

| Route | Purpose |
| --- | --- |
| `/sign-in` | Sign in and password reset OTP flow. |
| `/` | Dashboard overview, chart, room availability, reminders, and unpaid invoices. |
| `/rooms` | Client-rendered room list and room create/update management. |
| `/rooms/[id]` | Room detail, tenants, contract, and key tenant context. |
| `/rooms/[id]/utilities?month=&year=` | Monthly utility metrics and invoice generation for a room. |
| `/tenants` | Tenant directory with search, CRUD, detail, and CCCD image management. |
| `/invoices` | Client-rendered invoice list and payment status updates. |
| `/utility-pricing` | Utility pricing periods and rate management. |
| `/_staff` | Staff management screen currently hidden from the main navigation. |

## API Routes

Operational API routes return the shared `ApiResponse<T>` shape:

```ts
type ApiResponse<T> =
  | { ok: true; data: T; meta?: { timing?: unknown } }
  | { ok: false; error: ApiError; meta?: { timing?: unknown } };
```

Current app APIs:

| Endpoint | Purpose |
| --- | --- |
| `GET /api/foundation/current-user` | Resolve signed-in InsForge user to app user/role. |
| `GET /api/foundation/seeded-data` | Foundation check for seeded operational data. |
| `POST /api/foundation/rooms/touch` | Foundation write check for room updates. |
| `POST /api/auth/sign-in` | Sign in. |
| `POST /api/auth/sign-out` | Sign out. |
| `POST /api/auth/refresh` | Auth/session refresh helper. |
| `POST /api/auth/password-reset/request` | Send reset password email/OTP. |
| `POST /api/auth/password-reset/exchange` | Exchange reset OTP for a reset token. |
| `POST /api/auth/password-reset/complete` | Complete password reset. |
| `GET /api/rooms` | List rooms with computed display status. Used by `/rooms` and dashboard room availability. |
| `POST /api/rooms` | Create a room. |
| `GET /api/rooms/[id]/detail` | Room detail data. |
| `PATCH /api/rooms/[id]` | Update room name, base rent, or maintenance status. |
| `GET /api/rooms/[id]/operations-summary` | Room operations summary. |
| `GET /api/rooms/[id]/tenants` | List tenants for a room. |
| `GET /api/rooms/[id]/contracts` | List contracts for a room. |
| `GET /api/rooms/[id]/utility-metrics` | Read monthly utility metrics for a room. |
| `POST /api/rooms/[id]/utility-metrics` | Save monthly utility metrics for a room. |
| `GET /api/tenants` | List/search tenants. |
| `POST /api/tenants` | Create tenant. |
| `GET /api/tenants/[id]` | Tenant detail. |
| `PATCH /api/tenants/[id]` | Update tenant. |
| `DELETE /api/tenants/[id]` | Delete tenant. |
| `POST /api/tenants/[id]/cccd-images` | Upload tenant CCCD images. |
| `DELETE /api/tenants/[id]/cccd-images/[imageId]` | Delete tenant CCCD image from InsForge. |
| `PATCH /api/contracts/[id]` | Update contract data. |
| `GET /api/invoices` | List invoices. |
| `PATCH /api/invoices/[id]/payment` | Update invoice payment status and amount paid. |
| `GET /api/utility-pricing` | List utility pricing periods. |
| `POST /api/utility-pricing` | Create utility pricing period. |
| `PATCH /api/utility-pricing/[id]` | Update utility pricing period. |
| `DELETE /api/utility-pricing/[id]` | Delete utility pricing period. |
| `GET /api/staff` | List staff users. |
| `POST /api/staff` | Create staff user. |
| `PATCH /api/staff/[id]` | Update staff user/status. |
| `DELETE /api/staff/[id]` | Delete staff user. |
| `GET /api/dashboard/revenue` | Dashboard revenue chart data. |
| `GET /api/dashboard/missing-utility-metrics` | Dashboard missing monthly utility metric reminders. |
| `GET /api/dashboard/unpaid-invoices` | Dashboard unpaid invoice reminders. |

Note: `/api/dashboard/room-availability` was intentionally removed. Dashboard room availability now reuses `GET /api/rooms` and derives the summary in the UI presenter.

## Architecture

The current convention is documented in [docs/client-data-architecture.md](docs/client-data-architecture.md).

```text
Client page/shell
  -> TanStack Query useQuery/useMutation
  -> fetchAppApi()
  -> Next.js API route
  -> application service
  -> repository interface
  -> InsForge adapter
```

Important rules:

- UI should not call InsForge operational repositories directly.
- Client components should use `useQuery` for reads and `useMutation` for writes.
- Browser API calls should go through `fetchAppApi` from `src/lib/api/client.ts`.
- API routes should use shared response/error/timing helpers in `src/lib/api`.
- Protected operational APIs should use the shared operational auth/role helpers in `src/lib/server`.
- Writes should invalidate the relevant TanStack Query keys.

## Project Structure

```text
src/
  app/
    api/                  Next.js route handlers / BFF APIs
    invoices/             Invoice list screen
    rooms/                Room list, room detail, utilities screens
    tenants/              Tenant directory and tenant image UI
    utility-pricing/      Utility pricing management
    sign-in/              Authentication and password reset UI
    _staff/               Hidden staff management screen
    dashboard-client.tsx  Client dashboard composition
  components/
    dashboard/            Dashboard chart components
    layout/               App shell/sidebar/account menu
    ui/                   shadcn/ui and local UI primitives
    data-table.tsx        Reusable management data table
    query-provider.tsx    TanStack Query provider
    theme-provider.tsx    Theme provider
  lib/
    api/                  Shared API client, response, errors, timing
    auth/                 Auth and password reset domain logic
    dashboard/            Dashboard presenter/service/repository contracts
    data-table/           Data table state and TanStack helpers
    insforge/             InsForge SDK adapters and runtime config
    invoices/             Invoice presenter/service/repository contracts
    rooms/                Room presenter/service/repository contracts
    server/               Server-only auth and role helpers
    staff/                Staff presenter/service/repository contracts
    tenants/              Tenant presenter/service/repository contracts
    utilities/            Utility metric presenter/service/repository contracts
docs/                     Business and architecture notes
migrations/               Versioned InsForge SQL migrations
.scratch/mvp-tracer-bullet/issues/
                          Working MVP issue/ticket specs
schema.sql                Authoritative DB schema
```

## Data Model

Main tables from [schema.sql](schema.sql):

| Table | Purpose |
| --- | --- |
| `rooms` | Room name, base price, and maintenance flag/status. |
| `tenants` | Occupants, phone, profile fields, CCCD number/images, and active/moved-out status. |
| `contracts` | Room contract, key tenant, rent/deposit, and optional utility price overrides. |
| `utility_metrics` | Monthly electricity/water old/new readings per room. |
| `utility_pricing` | Effective electricity/water pricing periods. |
| `invoices` | Monthly invoice totals, extra fee note, amount paid, and payment status. |
| `app_users` | Maps InsForge auth users to app roles: Landlord or Staff. |

Room display status is computed by the Room domain:

1. Maintenance override wins.
2. Active contract means occupied.
3. Otherwise the room is available.

## Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Next.js dev server. |
| `npm run build` | Build the production app. |
| `npm run start` | Start the production build. |
| `npm run lint` | Run ESLint. |
| `npm test` | Run behavior tests. |
| `npm run perf:api-baseline` | Run authenticated API performance baseline. |
| `npx tsc --noEmit` | Run TypeScript validation without emitting files. |

## Validation Checklist

Before handing off a code change, run:

```bash
npm test
npx tsc --noEmit
npm run lint
git diff --check
```

Useful smoke checks while signed out:

```bash
curl http://localhost:3000/api/rooms
curl http://localhost:3000/api/foundation/current-user
```

Protected operational APIs should return `401` when not authenticated.

## More Documentation

- [docs/business-requirements.md](docs/business-requirements.md) - business goals and domain scope.
- [docs/client-data-architecture.md](docs/client-data-architecture.md) - client data migration convention.
- [docs/insforge-foundation.md](docs/insforge-foundation.md) - InsForge setup/runbook.
- [.scratch/mvp-tracer-bullet/spec.md](.scratch/mvp-tracer-bullet/spec.md) - evolving MVP tracer-bullet spec.
