# 27 — Installable PWA Mobile App Shell

**What to build:** Users can install the rental room management system on a mobile device and reopen it from a home-screen icon, so daily access feels like launching a lightweight app instead of typing the website URL.

**Blocked by:** 01 — Set Up Tailwind, shadcn/ui, Clay Dashboard, Charts, and Themes; 12 — Rooms Client Data and Management; 18 — Upgrade Management Data Tables.

**Status:** Done

- [x] The app exposes a valid Web App Manifest with app name, short name, description, start URL, display mode, theme color, background color, and Vietnamese-friendly metadata.
- [x] Mobile browsers can show an install/add-to-home-screen prompt when the app is served over HTTPS or localhost.
- [x] The installed app opens into the authenticated management system from its home-screen icon without browser chrome where supported.
- [x] App icons are available in required PWA sizes, including maskable icon support, and visually match the current clay dashboard brand.
- [x] The app has a mobile-safe launch experience with correct viewport, status bar color, and theme color behavior for light and dark mode.
- [x] If the user is not signed in, opening the installed app routes them to the login flow and preserves the existing post-login behavior.
- [x] If the user is signed in, opening the installed app lands on the configured start page without requiring a full manual URL entry.
- [x] A minimal service worker strategy is added only for app-shell/installability needs; operational management data must continue to come from authenticated APIs instead of stale offline cache.
- [x] PWA setup does not cache sensitive API responses, invoice PDFs, tenant images, CCCD images, auth tokens, cookies, or staff management data.
- [x] The UI includes a clear install affordance when supported by the browser, with a graceful fallback explaining how to add the app to the home screen when the native prompt is unavailable.
- [x] Install prompt state is handled on the client without causing hydration mismatch.
- [x] Existing desktop browser behavior, authenticated routing, React Query cache invalidation, and API calls continue to work unchanged.
- [x] Typecheck, lint, production build, and PWA manifest/installability checks pass.

## Implementation Notes

- Keep this ticket focused on installability and the mobile app shell. Do not add push notifications, background sync, or offline-first data behavior unless a later ticket explicitly asks for them.
- Prefer a conservative service worker configuration because this system contains private operational data. Static shell assets can be cached; authenticated API responses and uploaded identity images should not be cached by the PWA layer.
- The install affordance should feel native to the existing claymorphism UI and should not block normal login or navigation.
- Consider `/dashboard` as the installed app start destination for signed-in users, while preserving redirect-to-login for signed-out users.

## Completion Evidence

- The existing Dashboard route is `/`, so the manifest uses `/` as both `id` and `start_url`; the current auth proxy redirects signed-out launches to `/sign-in?next=/`.
- `npm test`: 92 tests passed, including manifest, icon dimensions, secure-origin registration, standalone detection, and service-worker cache isolation.
- `npm run pwa:check -- http://localhost:3108/sign-in`: Chrome discovered the manifest with no manifest/installability errors, and the service worker controlled the page at scope `/`.
- `npx tsc --noEmit`, `npm run lint`, and `npm run build` completed successfully. Lint retains one pre-existing unused-import warning in `src/components/layout/account-menu.tsx`.
