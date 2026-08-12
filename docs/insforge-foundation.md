# InsForge foundation runbook

Ticket 02 introduces the app-facing InsForge boundary for database, auth, roles,
and MVP seed data.

## Environment

Create `.env.local` from `.env.example`.

- `NEXT_PUBLIC_INSFORGE_URL`: InsForge project URL, for example the `oss_host`
  in `.insforge/project.json`.
- `NEXT_PUBLIC_INSFORGE_ANON_KEY`: public anonymous key for browser/server SSR
  clients.
- `INSFORGE_API_KEY`: server-only project admin key, used only for trusted
  setup/automation and Landlord-authorized Staff account provisioning. Routine
  Staff profile reads continue to use the signed-in user's session and RLS.
- `NEXT_PUBLIC_APP_URL`: local app URL for auth redirects.

## Database migration

The authoritative schema remains `schema.sql`. The versioned migration copy is:

```bash
npx @insforge/cli db migrations up --all
npx @insforge/cli db migrations list
```

Migration files:

- `migrations/20260802000000_insforge-db-auth-api-foundation.sql`
- `migrations/20260802010000_invoice-payment-status-constraints.sql`

## Auth and app roles

Create real InsForge auth users through the trusted InsForge admin setup path.
Then map each user to a Landlord or Staff role in `public.app_users`:

```sql
INSERT INTO public.app_users (auth_user_id, email, display_name, role)
VALUES
  ('<landlord-auth-user-id>', 'landlord@example.com', 'Landlord Demo', 'landlord'),
  ('<staff-auth-user-id>', 'staff@example.com', 'Staff Demo', 'staff')
ON CONFLICT (auth_user_id) DO UPDATE
SET email = EXCLUDED.email,
    display_name = EXCLUDED.display_name,
    role = EXCLUDED.role,
    updated_at = NOW();
```

## App-facing API checks

After signing in through `/sign-in`, verify:

- `GET /api/foundation/current-user` returns the signed-in user's Landlord or
  Staff role.
- `GET /api/foundation/seeded-data` returns Rooms, Tenants, Contracts,
  Utility Metrics, Utility Pricing, and Invoices through the adapter.
- `POST /api/foundation/rooms/touch` with `{ "roomId": "<uuid>" }` updates a
  Room `updated_at` value and returns the changed row.

Both endpoints resolve the current InsForge user and require a matching
`app_users` Landlord or Staff role.
