# Elume — B2B FMEG Procurement Platform

A vertical B2B procurement platform for Fast-Moving Electrical Goods (wires & cables,
switchgear, modular switches, distribution boards, LED lighting, fans). Built to scale
from day one: multi-tenant, fully database-driven (zero hardcoded catalogue), with a
clean path from prototype to production.

This is the prototype base. The first demo slice covers the three highest-value buyer
flows from the Elume documents:

1. **Multi-brand catalogue + transparent pricing** — same spec, every brand, side by side.
2. **Projects & BOM** — phased Bill of Materials with live priced rollup per construction stage.
3. **Portfolio dashboard** — multi-site rollup: committed spend, deliveries, credit utilisation, budget variance.

## Stack

- **Next.js 14** (App Router, TypeScript) + Tailwind — deploys to Vercel
- **Supabase** (Postgres + Auth + Storage + RLS) — multi-tenant
- **Drizzle ORM** with migration files (`drizzle/`)

## Architecture

```
src/
  app/(app)/            # authenticated app shell (sidebar layout)
    dashboard/          # portfolio rollup across sites
    projects/           # project list + BOM detail (phased)
    catalogue/          # multi-brand price comparison
  components/           # Sidebar, PageHeader, ui/ primitives
  lib/
    db/
      schema.ts         # 17-table multi-tenant schema (source of truth)
      index.ts          # lazy Drizzle client
      seed.ts           # representative catalogue + demo tenant
    queries/            # data-access layer (catalogue, projects, dashboard)
    auth/session.ts     # tenant resolution (swap-in point for Supabase Auth)
    supabase/           # Supabase server client (auth)
```

**Tenancy:** every buyer-owned row carries `organizationId`; queries are scoped by the
current org. `lib/auth/session.ts` is the single place to wire real Supabase Auth — every
page/query keeps working unchanged.

## Getting started

1. Create a hosted Supabase project, then fill in `.env.local` (see `.env.example`):
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `DATABASE_URL` (Transaction pooler URI)
2. Create the tables and load demo data:
   ```bash
   npm run db:push     # apply schema to Supabase
   npm run db:seed     # load catalogue + demo tenant (Skyline Electricals)
   ```
3. Run it:
   ```bash
   npm run dev         # http://localhost:3000
   ```

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Local dev server |
| `npm run build` | Production build |
| `npm run db:generate` | Generate SQL migration from schema |
| `npm run db:push` | Apply schema to the database |
| `npm run db:seed` | Load catalogue + demo tenant |
| `npm run db:studio` | Open Drizzle Studio (browse data) |

## Roadmap (next slices)

- Auth + login (Supabase) replacing the demo tenant resolver
- BOM editor: add/swap line items against live multi-brand pricing
- Smart BOM upload (BOQ parse → catalogue match)
- Purchase-order generation + approval flow inside the schedule
- NBFC credit application flow inside the order
- Admin panel for catalogue + pricing management
- Row-Level Security policies
