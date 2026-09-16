# FuelGuard

A fuel tracking and theft-detection portal for **Royal Dede Construction**.

Every litre issued from a site tanker is logged against the equipment that took it, with the meter
readings before and after. FuelGuard works out what each unit actually consumed, compares it with
the standard set for that equipment type, and raises an alert when the gap is too wide to be
explained by the work done. At the end of each month it reconciles what the tankers received against
what they issued, so fuel that went missing shows up as a variance rather than disappearing quietly.

---

## What it does

| Area | What happens there |
| --- | --- |
| **Fuel Entry** | The daily log register: date, equipment, driver/operator, litres, ODM or HM start and end, total km or hours, consumption, location & activity. Records takers file their own; administrators see every site. Exports to CSV. |
| **Dashboard** | KPIs, consumption charts, the watchlist of units drifting from standard, and the latest entries. |
| **Tankers** | Each tanker's running level, deliveries in (intakes), dip readings, and stock reconciliation — opening + received − issued vs. the measured dip. |
| **Theft Alerts** | The queue of raised alerts with their findings, read/unread state, review and resolution. |
| **Monthly Summary** | Per-equipment consumption averages, standards, variance and cost for a reporting period; close and reopen the month. Exports to CSV. |
| **Consumption Standards** | The L/km or L/hr standard per equipment type, and the alert thresholds that decide watch vs. flagged. |
| **Equipment & Vehicles**, **Sites**, **Operators**, **Users & Roles** | The setup behind all of the above. |

Two roles: **administrator** (everything) and **records taker** (files fuel entries for their own
site, and nothing else). Corrections to a filed entry need an administrator's approval — entries are
never edited away or deleted, only **voided**, which keeps the row visible and out of every total.

---

## Stack

- **Next.js 16** (App Router, server components, server actions) and React 19, with the React Compiler on
- **Neon Postgres** via **Drizzle ORM v1**, using SQL views for the derived figures (tank levels, reconciliation, monthly summary)
- **NextAuth v5** (credentials, JWT sessions), with `src/proxy.ts` doing the optimistic redirects
- **TanStack Query v5** for client reads, hydrated from the server
- **Tailwind CSS v4**, **lucide-react**, **sonner** for toasts

---

## Getting started

```bash
yarn install
cp .env.example .env     # then fill in DATABASE_URL and AUTH_SECRET
yarn db:migrate          # create the schema in your Neon database
SEED_PASSWORD='at-least-8-chars' yarn db:seed   # demo data + accounts to sign in with
yarn dev
```

Open [http://localhost:3000](http://localhost:3000). Signing in lands an administrator on the
Dashboard and a records taker on Fuel Entry.

### Scripts

| Command | Does |
| --- | --- |
| `yarn dev` / `yarn build` / `yarn start` | the usual Next.js three |
| `yarn db:generate` | write a migration after changing `src/db/schema.ts` — commit what it creates in `drizzle/` |
| `yarn db:migrate` | apply pending migrations; safe to re-run |
| `yarn db:push` | push the schema straight to the database, no migration file (local scratch databases only) |
| `yarn db:studio` | Drizzle Studio |
| `yarn db:seed` | demo sites, equipment, entries and sign-in accounts |

There's no linter configured, so type errors are the build's only gate: run `npx tsc --noEmit`
before pushing.

---

## Layout

```
src/
  app/
    api/            Route Handlers the client queries read from (_lib holds withActor + the status map)
    auth/login/     sign-in
    portal/         the app; (admin) is the route group only administrators may open
  components/       one folder per area, plus ui/ for the shared pieces
  db/               schema.ts, relations.ts, seed.ts — the views live in schema.ts as pgView
  queries/          TanStack Query keys, query options, and the mutation hook
  services/         all business logic; pages and routes call these, never Drizzle directly
  types/            shared types, one file per area
  utils/            formatting and route helpers used by components
drizzle/            generated migrations — committed, applied by hand
docs/               the long-form guides below
```

**Reads** go page → API route → service → Drizzle, cached by TanStack Query for 25 minutes (the
sidebar's unread-alert badge is the exception, at 30 seconds). **Writes** go through server actions
that call the same services, report success or failure with a toast, and invalidate the queries they
touched. A service takes its `Actor` as the last argument and decides for itself what that actor may
do; the audit log is written in the same `db.batch` as the change it records.

---

## Docs

| File | What's in it |
| --- | --- |
| [`docs/services.md`](docs/services.md) | the service layer: conventions, every class, every method, and which page calls it |
| [`docs/database-schema.md`](docs/database-schema.md) | tables, enums, check constraints and the views |
| [`docs/data-fetching.md`](docs/data-fetching.md) | API routes, query/mutation patterns, caching, the CSV downloads |
| [`docs/deployment.md`](docs/deployment.md) | deploying to Vercel: environment variables, migrations, pre-deploy checklist |

Times and dates are **Africa/Accra** throughout, whatever the viewer's device says.
