# Rental Room 201

Rental Room 201 is a rental-room management MVP for landlords and staff. It covers the core monthly workflow: manage rooms and occupants, record electricity/water metrics, generate invoices, track payment status, and monitor operational reminders from a dashboard.

The app is intentionally built as an authenticated management system, not a SEO-first public website. Operational pages render a fast shell and load mutable data through app-owned API routes with TanStack Query.

## Key Features

- Claymorphism dashboard with light/dark theme support.
- InsForge-backed authentication and role resolution for Landlord/Staff users.
- Room list and room management via client data fetching.
- Room detail, key tenant, active contract, utility metrics, and invoice context.
- Monthly utility metric entry with validation.
- Invoice generation from room rent, utility usage, pricing, and extra fees.
- Invoice payment status tracking: `Unpaid`, `Partially Paid`, `Paid`.
- Dashboard reminders for missing utility metrics and unpaid invoices.
- Shared API response/error/timing shape for operational endpoints.

## Tech Stack

| Area | Technology |
| --- | --- |
| Framework | Next.js `16.2.12` App Router |
| UI | React `19`, Tailwind CSS `4`, shadcn/ui, Radix UI |
| Client data | `@tanstack/react-query` |
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
- InsForge database schema applied from this repo
- A real InsForge auth account mapped to `public.app_users`

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
| `INSFORGE_API_KEY` | Server-only project API key for trusted setup/automation. Do not expose it to the browser. |
| `NEXT_PUBLIC_APP_URL` | App URL for local auth redirects, usually `http://localhost:3000`. |

### 3. Apply the InsForge database schema

The authoritative schema is [schema.sql](schema.sql). Versioned migration files live in [migrations](migrations).

```bash
npx @insforge/cli db migrations up --all
npx @insforge/cli db migrations list
```

See [docs/insforge-foundation.md](docs/insforge-foundation.md) for the current InsForge runbook.

### 4. Create/login app users

Registration is intentionally not public. Accounts should be created through the trusted InsForge/Admin path, then mapped to an app role in `public.app_users`.

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
| `/sign-in` | InsForge email/password sign in. |
| `/` | Dashboard overview, chart, room availability, reminders, unpaid invoices. |
| `/rooms` | Client-rendered room list and room create/update management. |
| `/rooms/[id]` | Room detail, tenants, contract, key tenant context. |
| `/rooms/[id]/utilities?month=&year=` | Monthly utility metric entry and invoice generation for a room. |
| `/invoices` | Client-rendered invoice list and payment status updates. |

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
| `GET /api/rooms` | List rooms with computed display status. Used by `/rooms` and dashboard room availability. |
| `POST /api/rooms` | Create a room. |
| `PATCH /api/rooms/[id]` | Update room name, base rent, or maintenance status. |
| `GET /api/rooms/[id]/detail` | Room detail data. |
| `GET /api/rooms/[id]/operations-summary` | Room operations summary. |
| `GET /api/rooms/[id]/utility-metrics` | Read monthly utility metrics for a room. |
| `POST /api/rooms/[id]/utility-metrics` | Save monthly utility metrics for a room. |
| `GET /api/invoices` | List invoices. |
| `PATCH /api/invoices/[id]/payment` | Update invoice payment status and amount paid. |
| `GET /api/dashboard/revenue` | Dashboard revenue chart data. |
| `GET /api/dashboard/missing-utility-metrics` | Dashboard missing monthly utility metrics reminders. |
| `GET /api/dashboard/unpaid-invoices` | Dashboard unpaid invoice reminders. |
| `GET /api/foundation/current-user` | Resolve signed-in InsForge user to Landlord/Staff app user. |
| `GET /api/foundation/seeded-data` | Foundation check for seeded operational data. |
| `POST /api/foundation/rooms/touch` | Foundation write check for room updates. |
| `POST /api/auth/refresh` | Auth/session refresh helper. |

Note: `/api/dashboard/room-availability` was intentionally removed. Dashboard room availability now reuses `GET /api/rooms`, then derives the dashboard summary in the UI presenter.

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
- API routes should use the shared response/error helpers in `src/lib/api`.
- Protected operational APIs resolve the current user through `resolveOperationalAppUser`.
- Writes should invalidate the relevant TanStack Query keys.

## Project Structure

```text
src/
  app/
    api/                  Next.js route handlers / BFF APIs
    invoices/             Invoice list screen
    rooms/                Room list, room detail, utilities screens
    sign-in/              Authentication UI
    dashboard-client.tsx  Client dashboard composition
  components/
    dashboard/            Dashboard chart components
    layout/               App shell/sidebar
    ui/                   shadcn/ui and local UI primitives
    query-provider.tsx    TanStack Query provider
    theme-provider.tsx    Theme provider
  lib/
    api/                  Shared API response, errors, timing, client helper
    dashboard/            Dashboard presenter/service/repository contracts
    insforge/             InsForge SDK adapters and runtime config
    invoices/             Invoice presenter/service/repository contracts
    rooms/                Room presenter/service/repository contracts
    server/               Server-only auth helpers
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
| `tenants` | Occupants, phone, key-tenant flag, CCCD URLs, active/moved-out status. |
| `contracts` | Room contract, key tenant, rent/deposit, optional utility price overrides. |
| `utility_metrics` | Monthly electricity/water old/new readings per room. |
| `utility_pricing` | Effective utility pricing periods. |
| `invoices` | Monthly invoice totals, amount paid, and payment status. |
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
| `npx tsc --noEmit` | Run TypeScript validation without emitting files. |

## Validation Checklist

Before handing off a code change, run:

```bash
npx tsc --noEmit
npm run lint
git diff --check
```

For API behavior while signed out, protected operational APIs should return `401`.

Useful smoke checks:

```bash
curl http://localhost:3000/api/rooms
curl http://localhost:3000/api/dashboard/room-availability
```

Expected result:

- `/api/rooms` returns `401` when not authenticated.
- `/api/dashboard/room-availability` returns `404` because that duplicated endpoint has been removed.

#
## More Documentation

- [docs/business-requirements.md](docs/business-requirements.md) — business goals and domain scope.
- [docs/client-data-architecture.md](docs/client-data-architecture.md) — client data migration convention.
- [docs/insforge-foundation.md](docs/insforge-foundation.md) — InsForge setup/runbook.
- [.scratch/mvp-tracer-bullet/spec.md](.scratch/mvp-tracer-bullet/spec.md) — evolving MVP tracer-bullet spec.
