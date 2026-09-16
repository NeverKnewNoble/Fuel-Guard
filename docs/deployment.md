# Deploying FuelGuard to Vercel

The app is a plain Next.js 16 project: Vercel's defaults are right, so there's no `vercel.json`.
What needs care is the database — Vercel never touches it, so migrations are run by hand.

---

## 1. Environment variables

Set these in **Project → Settings → Environment Variables**, ticking *Production*, *Preview* and
*Development*. The build imports `src/db/index.ts`, which throws if `DATABASE_URL` is missing, so a
missing value fails the build rather than the first request.

| Variable | Value | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Neon connection string | Neon dashboard → Connection details → **pooled** connection, `?sslmode=require`. |
| `AUTH_SECRET` | `openssl rand -base64 33` | Encrypts the session cookie. Changing it signs everyone out. |

Not needed on Vercel: `AUTH_URL` and `AUTH_TRUST_HOST`. NextAuth detects Vercel and trusts the
deployment host on its own — those two are only for self-hosting behind `next start`.
`SEED_PASSWORD` is only read by the local seed script; never set it in production.

`.env.example` is the checked-in copy of this list. `.env` is git-ignored — keep it that way.

---

## 2. Database

Neon is a separate service from Vercel; the deploy does **not** migrate it. Run migrations yourself,
pointing `DATABASE_URL` at the database the deployment uses:

```bash
yarn db:migrate     # applies everything in drizzle/ that hasn't run yet; safe to re-run
yarn db:generate    # only after changing src/db/schema.ts — commit the new folder in drizzle/
```

Order matters: **migrate before the deploy goes live**, or the running app queries columns and views
that don't exist yet. `drizzle/` is committed, so every migration folder must be in the commit you
deploy.

A first deploy also needs one administrator to sign in with:

```bash
SEED_PASSWORD='choose-a-password' yarn db:seed
```

Note that `src/db/seed.ts` also inserts demo sites, equipment and entries. For a real hand-over,
create the administrator and let the client build their own data through Sites, Operators and
Equipment.

---

## 3. What the build does

- `next build` — the build command, no flags. Everything under `/portal` and `/api` is dynamic
  (`ƒ` in the build output), because each reads the session; only `/`, `/auth/login` and the icon
  are prerendered.
- `reactCompiler: true` in `next.config.ts` needs `babel-plugin-react-compiler`. It's a
  devDependency, which Vercel installs during the build, so nothing more is needed.
- No ESLint config is present, so `next build` doesn't lint. Type errors **do** fail the build —
  run `npx tsc --noEmit` before pushing.
- `src/proxy.ts` (what used to be middleware) runs on the **Node.js** runtime in Next 16, so its
  imports of `next-auth`, `bcryptjs` and the Neon driver are fine; there's no Edge bundle limit to
  stay under.

---

## 4. Checklist for a deploy

1. `npx tsc --noEmit` and `yarn build` both clean locally.
2. `yarn db:generate` says *No schema changes* — otherwise commit the generated migration.
3. `yarn db:migrate` against the deployment's database.
4. `DATABASE_URL` and `AUTH_SECRET` set for the environment being deployed.
5. `drizzle/`, `docs/`, `src/` committed; `.env` not.
6. After the deploy: sign in, and open Tankers — it's the page that touches the most views
   (`v_tank_levels`, `v_tank_reconciliation`), so it fails loudly if a migration was missed.
