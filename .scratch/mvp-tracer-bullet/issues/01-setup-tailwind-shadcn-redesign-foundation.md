# 01 — Set Up Tailwind, shadcn/ui, Clay Dashboard, Charts, and Themes

**What to build:** Redesign the existing Next.js app shell and MVP screens around Tailwind CSS v4 and shadcn/ui so the product feels like a polished rental operations dashboard with restrained claymorphism. Add a responsive six-month billed-versus-collected revenue chart and persisted light/dark/system themes. This ticket is UI-only: keep or introduce local mock/demo data so Dashboard, Rooms, Room detail, Utility Metrics, and Invoices can be opened immediately before InsForge is wired in.

**Blocked by:** None — can start immediately.

**Status:** Human review

- [x] Tailwind CSS v4 is configured with the documented PostCSS setup and global CSS import.
- [x] shadcn/ui is initialized for the existing Next.js project with CSS variable theming.
- [x] Base shadcn/ui components are available for Button, Input, Label, Card, Badge, Table, Dialog, Select, Textarea, Separator, Skeleton, and Sonner.
- [x] Existing app shell navigation is redesigned with Tailwind/shadcn-compatible styles.
- [x] Dashboard, Rooms, Room detail, Utility Metrics, and Invoices share a consistent plain operational visual foundation.
- [x] Shared surfaces, controls, cards, navigation, tables, and forms use restrained claymorphism with consistent lighting and readable contrast in both light and dark themes.
- [x] The app provides light, dark, and system appearance options, persists the choice locally, and avoids hydration mismatch or theme flashing.
- [x] The dashboard includes a responsive, accessible six-month chart comparing billed revenue with collected revenue from mock/demo data.
- [x] The chart uses theme-aware colors, readable axes/tooltips, and remains usable on mobile and desktop widths.
- [x] Navigation uses the floating top-shell pattern while preserving route slugs and active-route indication.
- [x] Geist Sans and Geist Mono are self-hosted and numerical data uses tabular figures.
- [x] Primary screens can be opened with mock/demo data before InsForge is configured.
- [x] Loading, empty, error, validation, saving, and success states have reusable UI patterns.
- [x] The UI remains responsive for desktop and mobile operational workflows.
- [x] The redesign does not change route slugs or the core information architecture.