# FuelGuard — Service Layer Guide

The classes to build in `src/services/`, every function each one needs, what the function does step by step, and which page calls it. Written to be worked from **offline**: it assumes the schema in [`database-schema.md`](./database-schema.md), which is implemented in `src/db/schema.ts` and `src/db/relations.ts`.

**Contents**

1. [How the pieces fit](#1-how-the-pieces-fit)
2. [Conventions (read first)](#2-conventions-read-first)
3. [Shared files](#3-shared-files)
4. [Services](#4-services)
5. [Page → service map](#5-page--service-map)
6. [Drizzle cheat sheet for this project](#6-drizzle-cheat-sheet-for-this-project)
7. [Suggested build order](#7-suggested-build-order)

---

## 1. How the pieces fit

```
Page (server component)  ──reads──▶  Service.method()  ──▶  Drizzle (db)
        │
Client component / modal form
        │ submits
        ▼
Server action (actions.ts)  ──calls──▶  Service.method()  ──▶  Drizzle (db)
        │
        └─ revalidatePath() so the page shows fresh data
```

| Layer | Lives in | Responsible for | Must NOT |
| --- | --- | --- | --- |
| **Page** | `src/app/portal/**/page.tsx` | Calling read methods and passing plain data to components | Write SQL |
| **Server action** | `src/app/portal/<page>/actions.ts` (`"use server"`) | Reading `FormData`, getting the signed-in user, calling a service, catching `ServiceError`, `revalidatePath` | Contain business rules or SQL |
| **Service** | `src/services/<name>Service.ts` | Business rules, permission checks, validation, all Drizzle queries | Read `FormData`, call `redirect`, touch React |
| **Schema** | `src/db/schema.ts` | Tables, views, enums | — |

**Done:** every portal page now reads from these services through TanStack Query, and `src/utils/sampleData.tsx` has been deleted. See [`data-fetching.md`](./data-fetching.md) for how a page loads and saves data.

---

## 2. Conventions (read first)

### 2.1 File and class naming

Match the repo's existing camelCase file names:

| File | Class |
| --- | --- |
| `src/services/fuelEntryService.ts` | `export class FuelEntryService` |
| `src/services/theftAlertService.ts` | `export class TheftAlertService` |

Use **static methods**. The services hold no state, so there's nothing to instantiate:

```ts
// src/services/siteService.ts
import { db } from "@/db";
import { sites } from "@/db/schema";

export class SiteService {
  static async list() {
    return db.query.sites.findMany({ where: { archivedAt: { isNull: true } }, orderBy: { name: "asc" } });
  }
}
```

### 2.2 The `Actor` (signed-in user)

Every method that changes data, or depends on who is asking, takes an `actor` as its **last** argument. The actor is `session.user` from NextAuth:

```ts
// src/services/types.ts
import type { AppUserRole } from "@/types/next-auth";

export type Actor = { id: string; role: AppUserRole; siteId: string | null };
```

Services check permissions themselves, even though the proxy and layouts also guard pages. Server actions are plain POST endpoints and can be called directly.

### 2.3 Types from the schema

Don't hand-write row types. Infer them:

```ts
import type { fuelEntries } from "@/db/schema";

type FuelEntryRow = typeof fuelEntries.$inferSelect;   // what a select returns
type NewFuelEntry = typeof fuelEntries.$inferInsert;   // what an insert accepts
```

### 2.4 Numbers come back as strings

Every `numeric` column (litres, costs, standards, percentages) is returned by Postgres as a **string**, e.g. `"210.00"`, so precision isn't lost. Do the conversion once, in the service, before returning data to a page:

```ts
// src/services/utils.ts
export const toNumber = (v: string | null) => (v === null ? null : Number(v));
export const toNumeric = (n: number, scale = 2) => n.toFixed(scale); // for inserts
```

Pages and components should only ever receive `number`s.

### 2.5 Errors

Services **throw**; server actions **catch** and turn the error into a message for the form. See [`errors.ts`](#31-srcserviceserrorsts).

### 2.6 Multi-step writes: `db.batch`, not `db.transaction`

The app uses the `neon-http` driver, which **does not support `db.transaction()`**; calling it throws `No transactions support in neon-http driver`. Use `db.batch([...])` instead. It sends every query in one request, and they all succeed or all fail.

A batch can't use one query's result in the next, so:

1. **Do all reads first** (load the equipment, the tank, the thresholds…).
2. **Generate ids in code** with `crypto.randomUUID()` so rows can reference each other.
3. **Put every write in one batch.**

```ts
const entryId = crypto.randomUUID();
const alertId = crypto.randomUUID();

const [[entry]] = await db.batch([
  db.insert(fuelEntries).values({ id: entryId, ...values }).returning({ id: fuelEntries.id, code: fuelEntries.code }),
  db.insert(theftAlerts).values({ id: alertId, ...alertValues }),
  db.insert(alertFuelEntries).values({ alertId, fuelEntryId: entryId }),
]);
```

If you ever need a true interactive transaction (read inside it, then decide), switch `src/db/index.ts` to `drizzle-orm/neon-serverless` with a WebSocket `Pool`. Nothing in this guide requires that.

### 2.7 Time zone

Timestamps are stored in UTC and the business runs on `Africa/Accra` time. Anything grouped by "day" or "month" must use that zone. The views already do. In code, build month boundaries with a helper:

```ts
// src/services/utils.ts
/** First day of the month containing `date`, in Accra time, as 'YYYY-MM-01'. */
export function monthStart(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Accra", year: "numeric", month: "2-digit" })
    .formatToParts(date);
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  return `${y}-${m}-01`;
}
```

(Accra is UTC+0 all year, so `date.toISOString().slice(0, 7) + "-01"` also works today; the helper keeps it correct if that ever changes.)

### 2.8 Audit

Anything that edits reference data, changes a role, resolves an alert, corrects an entry or closes a period also writes an `audit_log` row **in the same batch**. See [`AuditLogService`](#421-auditlogservice).

### 2.9 The server action pattern (copy this)

> **Updated:** pages now read through TanStack Query and write through mutation hooks. Actions take only `formData` (no `_prev`), don't call `revalidatePath`, and `ActionState` lives in `src/types/actions.ts`. See [`data-fetching.md`](./data-fetching.md) §5; the example below shows the original `useActionState` shape.

```ts
// src/app/portal/fuel_entry/actions.ts
"use server";

import { revalidatePath } from "next/cache";

import { FuelEntryService } from "@/services/fuelEntryService";
import { ServiceError, ValidationError } from "@/services/errors";
import { SessionService } from "@/services/sessionService";

export type ActionState =
  | { ok: true; message: string }
  | { ok: false; error: string; fields?: Record<string, string> }
  | undefined;

export async function createFuelEntryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await SessionService.requireUser();

  try {
    const result = await FuelEntryService.create(
      {
        dispensedAt: new Date(`${formData.get("date")}T${formData.get("time")}`),
        equipmentId: String(formData.get("equipmentId")),
        tankId: String(formData.get("tankId")),
        operatorId: String(formData.get("operatorId")),
        litres: Number(formData.get("litres")),
        odometerStart: optionalNumber(formData.get("odometerStart")),
        odometerEnd: optionalNumber(formData.get("odometerEnd")),
        hourMeterStart: optionalNumber(formData.get("hourMeterStart")),
        hourMeterEnd: optionalNumber(formData.get("hourMeterEnd")),
        locationActivity: String(formData.get("site") ?? ""),
      },
      actor
    );
    revalidatePath("/portal/fuel_entry");
    return { ok: true, message: `${result.entry.code} saved` };
  } catch (error) {
    if (error instanceof ServiceError) {
      return { ok: false, error: error.message, fields: error instanceof ValidationError ? error.fields : undefined };
    }
    throw error;
  }
}

const optionalNumber = (v: FormDataEntryValue | null) => (v === null || v === "" ? null : Number(v));
```

The modal then uses `useActionState(createFuelEntryAction, undefined)`, the same way `src/components/auth/loginForm.tsx` does.

---

## 3. Shared files

### 3.1 `src/services/errors.ts`

```ts
export class ServiceError extends Error {
  constructor(message: string, public readonly code: string = "SERVICE_ERROR") {
    super(message);
    this.name = new.target.name;
  }
}

/** Not signed in. */
export class UnauthorizedError extends ServiceError {
  constructor(message = "Please sign in again.") { super(message, "UNAUTHORIZED"); }
}

/** Signed in, but the role or site doesn't allow this. */
export class ForbiddenError extends ServiceError {
  constructor(message = "You don't have permission to do that.") { super(message, "FORBIDDEN"); }
}

export class NotFoundError extends ServiceError {
  constructor(what: string) { super(`${what} was not found.`, "NOT_FOUND"); }
}

/** Input breaks a rule. `fields` maps form field names to messages. */
export class ValidationError extends ServiceError {
  constructor(message: string, public readonly fields?: Record<string, string>) { super(message, "VALIDATION"); }
}

/** Duplicate or state clash (e.g. email already used, alert already resolved). */
export class ConflictError extends ServiceError {
  constructor(message: string) { super(message, "CONFLICT"); }
}

/** Postgres unique-violation check — Drizzle wraps driver errors, so look at `cause` too. */
export function isUniqueViolation(error: unknown, constraint?: string) {
  const e = error as { code?: string; constraint?: string; cause?: { code?: string; constraint?: string } };
  const code = e?.code ?? e?.cause?.code;
  const name = e?.constraint ?? e?.cause?.constraint;
  return code === "23505" && (!constraint || name === constraint);
}
```

### 3.2 `src/services/types.ts`

`Actor` (§2.2) plus shared DTOs that several services return. Put a type here when more than one service uses it; otherwise keep it next to the service.

### 3.3 `src/services/utils.ts`

`toNumber`, `toNumeric` (§2.4), `monthStart` (§2.7), and:

```ts
/** Pads the result of a count(*) — Postgres returns bigint counts as strings. */
export const toCount = (v: unknown) => Number(v ?? 0);

/** For "Sep 1" chart labels. */
export const shortDate = (d: Date | string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Accra", month: "short", day: "numeric" }).format(new Date(d));
```

---

## 4. Services

Each service lists:
- **File** and **Used by** (pages and components)
- **Tables** it reads or writes
- **Methods**, with what each does step by step

Permission shorthand: **Admin** = `actor.role === "administrator"`. **Any** = any signed-in user.

---

### 4.1 `SessionService`

**File:** `src/services/sessionService.ts`
**Used by:** every server action; any page that needs the current user.
**Tables:** none (reads the NextAuth session).

```ts
export class SessionService {
  static async getActor(): Promise<Actor | null>
  static async requireUser(): Promise<Actor>
  static async requireAdmin(): Promise<Actor>
  static assertAdmin(actor: Actor): void
  static canAccessSite(actor: Actor, siteId: string | null): boolean
  static assertSiteAccess(actor: Actor, siteId: string | null): void
}
```

| Method | What it does |
| --- | --- |
| `getActor()` | `const session = await auth()` (from `@/auth`). Return `{ id, role, siteId }` from `session.user`, or `null` when not signed in. |
| `requireUser()` | `getActor()`; throw `UnauthorizedError` if `null`. Call this first in every server action. |
| `requireAdmin()` | `requireUser()`, then `assertAdmin`. |
| `assertAdmin(actor)` | Throw `ForbiddenError` unless the role is `administrator`. Services call this at the top of admin-only methods. |
| `canAccessSite(actor, siteId)` | `true` if the actor is an admin, the actor has no site ("All sites"), or `actor.siteId === siteId`. |
| `assertSiteAccess(actor, siteId)` | Throw `ForbiddenError("That record belongs to another site.")` when `canAccessSite` is false. |

> Optional tidy-up: move the credential lookup in `src/auth.ts` (`authorize`) into `UserService.verifyCredentials` so all user queries live in one place.

---

### 4.2 `UserService`

**File:** `src/services/userService.ts`
**Used by:** Users & Roles page (stat tiles, Accounts table, row ⋯ menu), Create New User modal, `src/auth.ts` (sign-in), sidebar user card.
**Tables:** `users`, `sites`, `audit_log`.

```ts
export class UserService {
  static async listAccounts(filters?: { role?: AppUserRole; status?: AccountStatus; siteId?: string; search?: string }): Promise<AccountRow[]>
  static async getStats(): Promise<{ administrators: number; recordsTakers: number; active: number; total: number }>
  static async getById(id: string): Promise<AccountRow>
  static async findByEmail(email: string)
  static async verifyCredentials(email: string, password: string): Promise<Actor & { name: string; email: string } | null>
  static async create(input: CreateUserInput, actor: Actor): Promise<{ id: string; code: string }>
  static async updateProfile(userId: string, input: { name?: string; email?: string }, actor: Actor): Promise<void>
  static async changeRole(userId: string, input: { role: AppUserRole; siteId: string | null }, actor: Actor): Promise<void>
  static async setStatus(userId: string, status: AccountStatus, actor: Actor): Promise<void>
  static async setPassword(userId: string, newPassword: string, actor: Actor): Promise<void>
  static async touchLastActive(userId: string): Promise<void>
}

type AccountRow = { id; code; name; email; role; roleLabel; status; siteId; siteName /* "All sites" when null */; lastActiveAt: Date | null };
type CreateUserInput = { name: string; email: string; role: AppUserRole; siteId: string | null; password?: string };
```

| Method | Page / trigger | What it does |
| --- | --- | --- |
| `listAccounts(filters)` | Users & Roles → **Accounts** table | 1. `db.query.users.findMany` with `columns: { passwordHash: false }`, `with: { site: true }`, `orderBy: { name: "asc" }`. 2. Apply filters with `where` (`search` → `OR` over `name`/`email` with `ilike: "%term%"`). 3. Map to `AccountRow`: `siteName = site?.name ?? "All sites"`, `roleLabel = roleLabels[role]` (from `@/utils/authRoutes`). **Never return `passwordHash`.** |
| `getStats()` | Users & Roles → 3 stat tiles | One query: `select count(*) filter (where role='administrator'), count(*) filter (where role='records_taker'), count(*) filter (where status='active'), count(*) from users`. Convert with `toCount`. Tile hint "of N total" uses `total`. |
| `getById(id)` | Edit user (⋯ → Edit) | Same shape as a list row. Throw `NotFoundError("User")` if missing. |
| `findByEmail(email)` | internal | `where: { RAW: (t) => sql\`lower(${t.email}) = lower(${email.trim()})\` }`. Returns the row **including** `passwordHash`; internal use only. |
| `verifyCredentials(email, password)` | Login (`src/auth.ts`) | 1. `findByEmail`. 2. Return `null` unless `status === "active"` and `passwordHash` is set. 3. `bcrypt.compare`. 4. On success `touchLastActive` and return `{ id, name, email, role, siteId }`. Always return the same `null` for "no user", "wrong password" and "disabled", so the error message can't reveal which accounts exist. |
| `create(input, actor)` | **Create New User** modal (`createUserModal.tsx`) | 1. `assertAdmin`. 2. Trim name/email, lower-case email. 3. Validate: name required; email looks valid; `records_taker` must have `siteId` → `ValidationError({ siteId: "Pick a site" })`. 4. If `findByEmail` finds a row → `ConflictError("An account with that email already exists.")`. 5. `status = input.password ? "active" : "invited"`; hash the password with `bcrypt.hash(pw, 12)` when given. 6. `db.batch([insert users (id from randomUUID, invitedBy: actor.id) returning {id, code}, AuditLogService.entry(actor.id, "user.create", "users", id, null, {name, email, role, siteId})])`. The modal's **"Send invite"** checkbox needs an email service and an invite-token table, neither of which exists yet. Until then, admins set a password with `setPassword`. |
| `updateProfile(userId, input, actor)` | ⋯ → Edit | Admin, or the user editing themselves. Same email checks as `create` (ignoring their own row). Batch the update with an audit entry holding before and after values. |
| `changeRole(userId, input, actor)` | ⋯ → Edit (role/site) | 1. `assertAdmin`. 2. Load the user (`before`). 3. `records_taker` needs a `siteId`; `administrator` may have `null`. 4. **Last-admin guard:** if demoting an administrator, count active administrators; if it's 1, throw `ConflictError("There must be at least one active administrator.")`. 5. Batch: update `role`, `siteId`, plus audit `user.role_change`. 6. The user's existing session keeps the old role until they sign in again. Mention this in the UI message. |
| `setStatus(userId, status, actor)` | ⋯ → Disable / Enable | 1. `assertAdmin`. 2. Can't disable yourself (`userId === actor.id` → `ConflictError`). 3. Last-admin guard as above when disabling an admin. 4. Batch update + audit `user.status_change`. Users are never deleted, because too many records point at them; disabling blocks sign-in. |
| `setPassword(userId, newPassword, actor)` | ⋯ → Set password; later a "change password" page | 1. Allowed for an admin or `actor.id === userId`. 2. At least 8 characters → otherwise `ValidationError({ password: "…" })`. 3. `bcrypt.hash(newPassword, 12)`. 4. Update `passwordHash`; if the status was `invited`, set it to `active`. 5. Audit `user.password_set` with **no** hash in before/after. |
| `touchLastActive(userId)` | sign-in | `update users set last_active_at = now()`. The Accounts table's "Last active" column reads this. |

---

### 4.3 `SiteService`

**File:** `src/services/siteService.ts`
**Used by:** every "Site" dropdown (Create User, Add Equipment, Add Tanker), filters.
**Tables:** `sites`, `equipment`, `tanks`, `audit_log`.

```ts
export class SiteService {
  static async list(options?: { includeArchived?: boolean }): Promise<{ id; code; name; region }[]>
  static async getById(id: string)
  static async create(input: { code: string; name: string; region?: string }, actor: Actor)
  static async update(id: string, input: { name?: string; region?: string }, actor: Actor)
  static async archive(id: string, actor: Actor)
}
```

| Method | What it does |
| --- | --- |
| `list()` | `db.query.sites.findMany({ where: { archivedAt: { isNull: true } }, orderBy: { name: "asc" } })`. With `includeArchived`, drop the `where`. |
| `getById(id)` | Find by id or throw `NotFoundError("Site")`. |
| `create(input, actor)` | Admin. Upper-case and trim `code`. Insert; catch `isUniqueViolation` → `ConflictError("Site code already used.")`. Audit. |
| `update(id, input, actor)` | Admin. Update name/region. Audit. |
| `archive(id, actor)` | Admin. Refuse (`ConflictError`) while any non-retired `equipment` or non-archived `tanks` still belong to the site. Tell the admin to move them first. Set `archivedAt = new Date()`. Audit. |

---

### 4.4 `OperatorService`

**File:** `src/services/operatorService.ts`
**Used by:** New Fuel Entry modal → **Driver / operator** select. The current code lists `userAccounts`; switch it to operators.
**Tables:** `operators`, `users`.

```ts
export class OperatorService {
  static async listActive(options?: { siteId?: string }): Promise<{ id; name; siteId; siteName }[]>
  static async create(input: { name: string; phone?: string; siteId?: string; userId?: string }, actor: Actor)
  static async update(id: string, input: Partial<{ name; phone; siteId }>, actor: Actor)
  static async deactivate(id: string, actor: Actor)
  static async linkUser(operatorId: string, userId: string | null, actor: Actor)
}
```

| Method | What it does |
| --- | --- |
| `listActive({ siteId })` | `where: { isActive: true }` (plus `siteId` when given), `with: { site: true }`, ordered by name. For a records taker, pass their `siteId` but keep operators with `siteId = null` too, using `OR: [{ siteId }, { siteId: { isNull: true } }]`. |
| `create(input, actor)` | Admin. Name required. If `userId` is given, make sure no other operator already links it (unique column) → `ConflictError`. |
| `update` | Admin. |
| `deactivate(id, actor)` | Admin. `isActive = false`. Past fuel entries keep pointing at the operator, which is why it's never deleted. |
| `linkUser` | Admin. Set or clear `userId`. |

> **Done:** `/portal/operators` (Set-up → Drivers & Operators). Sites have their own page too, `/portal/sites`.

---

### 4.5 `EquipmentTypeService`

**File:** `src/services/equipmentTypeService.ts`
**Used by:** Consumption Standards → **Standards by equipment type** table (edit via ⋯); Add Equipment modal → **Type** select.
**Tables:** `equipment_types`, `equipment`, `audit_log`.

```ts
export class EquipmentTypeService {
  static async list(): Promise<{ id; name; basis; measurementLabel; lKmStandard: number | null; lHrStandard: number | null; unitCount: number }[]>
  static async getById(id: string)
  static async create(input: { name: string; basis: "hours" | "km"; lKmStandard?: number; lHrStandard?: number }, actor: Actor)
  static async updateStandard(id: string, input: { basis: "hours" | "km"; lKmStandard?: number | null; lHrStandard?: number | null }, actor: Actor)
  static async remove(id: string, actor: Actor)
}
```

| Method | Page / trigger | What it does |
| --- | --- | --- |
| `list()` | Consumption Standards table; Add Equipment "Type" | Select types left-joined to a `count(equipment.id)` grouped by type. `measurementLabel = basis === "hours" ? "Hour meter (hrs)" : "Odometer (km)"` (matches `MeasurementBasis` in `src/types/standards.ts`). Convert numerics. |
| `create(input, actor)` | "Add type" (new button) | 1. Admin. 2. **Only the standard that matches the basis** may be set: `km` needs `lKmStandard > 0` and no `lHrStandard`, `hours` the opposite. The DB check `equipment_types_standard_matches_basis` enforces this too, but validate first for a friendly message. 3. Insert (`toNumeric(v, 3)` for L/km, `toNumeric(v, 2)` for L/hr); unique name → `ConflictError`. 4. Audit `standard.create`. |
| `updateStandard(id, input, actor)` | ⋯ → Edit on a row | Admin. Same validation as `create`. Set the unused standard to `null` when the basis changes. Batch update + audit `standard.update` with before/after. Existing alerts aren't recalculated; only new entries use the new standard. Say so in the success message. |
| `remove(id, actor)` | ⋯ → Delete | Admin. If any equipment uses the type → `ConflictError("N units use this type.")`. Otherwise delete. |

---

### 4.6 `AlertThresholdService`

**File:** `src/services/alertThresholdService.ts`
**Used by:** Consumption Standards → **Alert thresholds** cards and **Edit thresholds** button; `AlertDetectionService`; the Monthly Summary status (the view reads the table directly).
**Tables:** `alert_thresholds`, `audit_log`.

```ts
export class AlertThresholdService {
  static async list(): Promise<{ level: AlertSeverity; label: string; percent: number }[]>
  static async getMap(): Promise<Record<AlertSeverity, number>>
  static async update(input: Record<AlertSeverity, number>, actor: Actor): Promise<void>
  static severityFor(variancePct: number, thresholds: Record<AlertSeverity, number>): AlertSeverity | null
}
```

| Method | What it does |
| --- | --- |
| `list()` | Select all three rows and sort in code as `watch → high → critical`. Labels: `Watch`, `High / flagged`, `Critical`, matching `alertThresholds` in `sampleData.tsx`. If a row is missing, throw `ServiceError("Alert thresholds are not set up — run the seed script.")`. |
| `getMap()` | `{ watch: 5, high: 15, critical: 25 }` as numbers. Detection uses this. |
| `update(input, actor)` | 1. Admin. 2. Every value must be `> 0` and `watch < high < critical`; otherwise `ValidationError({ high: "Must be above Watch" })` etc. A database check can't compare rows, so this rule lives only here. 3. `db.batch` with three upserts: `insert(alertThresholds).values({ level, percent, updatedBy }).onConflictDoUpdate({ target: alertThresholds.level, set: { percent, updatedBy: actor.id, updatedAt: new Date() } })`, plus audit `threshold.update`. |
| `severityFor(pct, t)` | **Pure.** `pct >= t.critical → "critical"`, `>= t.high → "high"`, `>= t.watch → "watch"`, else `null`. |

---

### 4.7 `EquipmentService`

**File:** `src/services/equipmentService.ts`
**Used by:** Equipment & Vehicles (stat tiles, Registry table, Add Equipment modal, ⋯ menu); New Fuel Entry modal → **Equipment** select and the auto-filled **Equipment type**; Dashboard "Active equipment" tile.
**Tables/views:** `equipment`, `equipment_types`, `sites`, `v_equipment_standards`, `audit_log`.

```ts
export class EquipmentService {
  static async list(filters?: { siteId?: string; status?: EquipmentStatus; typeId?: string; search?: string }): Promise<EquipmentRow[]>
  static async getStats(): Promise<{ active: number; maintenance: number; idle: number; retired: number; total: number }>
  static async getById(id: string): Promise<EquipmentDetail>
  static async getEffectiveStandard(id: string): Promise<{ basis: "hours" | "km"; lKmStandard: number | null; lHrStandard: number | null }>
  static async listForEntryForm(actor: Actor): Promise<{ id; code; typeName; basis; siteId }[]>
  static async create(input: CreateEquipmentInput, actor: Actor): Promise<{ id: string; code: string }>
  static async update(id: string, input: Partial<CreateEquipmentInput>, actor: Actor): Promise<void>
  static async setStatus(id: string, status: EquipmentStatus, actor: Actor): Promise<void>
  static async moveToSite(id: string, siteId: string, actor: Actor): Promise<void>
}

type EquipmentRow = { id; code; typeName; makeModel; siteId; siteName; status; lKmStd: number | null; lHrStd: number | null };
type CreateEquipmentInput = {
  code?: string; equipmentTypeId: string; makeModel: string; registrationNo?: string; siteId: string;
  fuelTankCapacityL?: number; lKmStandardOverride?: number | null; lHrStandardOverride?: number | null;
};
```

| Method | Page / trigger | What it does |
| --- | --- | --- |
| `list(filters)` | Equipment & Vehicles → **Registry** | Select from `vEquipmentStandards` joined to `sites` for the site name (views have no relations, so use `db.select().from(vEquipmentStandards).innerJoin(sites, eq(sites.id, vEquipmentStandards.siteId))`). The view's `lKmStandard`/`lHrStandard` are already the **effective** standard (override ?? type default). Order by `equipmentCode`. Map to `EquipmentRow`, which matches the `Equipment` type the page uses today. |
| `getStats()` | 3 stat tiles; Dashboard tile | `count(*) filter (where status = …)` for each status. The Dashboard shows `active` and `maintenance + idle` as "idle / maintenance". |
| `getById(id)` | ⋯ → Edit; fuel entry | `db.query.equipment.findFirst({ where: { id }, with: { type: true, site: true } })` → `NotFoundError("Equipment")`. |
| `getEffectiveStandard(id)` | internal (detection) | Read the id's row from `vEquipmentStandards`. |
| `listForEntryForm(actor)` | New Fuel Entry → Equipment select (`"EQ-001 — Excavator"`) | Units with `status` in `active`/`idle`. `maintenance` and `retired` units can't draw fuel. For a records taker, only their site. Include `basis` so the modal can show only the matching meter fieldset. |
| `create(input, actor)` | **Add Equipment** modal | 1. Admin. 2. The type and site must exist. 3. Validate `makeModel` is required, and overrides/capacity are `> 0` when given. 4. The modal's **L/km standard / L/hr standard** fields: store a value **only if it differs from the type default**, otherwise `null`, so later changes to the type still apply. A value for the wrong basis → `ValidationError`. 5. If `code` is typed in, use it (upper-cased); otherwise leave it out and the sequence generates `EQ-###`. 6. Insert with `returning({ id, code })`; unique violation on `code` or `registration_no` → `ConflictError`. 7. Audit. |
| `update(id, input, actor)` | ⋯ → Edit | Admin. Same checks. Changing `equipmentTypeId` resets both overrides to `null` unless new ones are given. Batch update + audit. |
| `setStatus(id, status, actor)` | ⋯ → Mark maintenance / idle / active / retire | Admin. Batch update + audit `equipment.status_change`. Retired units stay in history but vanish from forms and the monthly summary. |
| `moveToSite(id, siteId, actor)` | ⋯ → Move | Admin. Updates `siteId`. Past entries keep their own `site_id` snapshot, so history is unaffected. Audit. |

---

### 4.8 `SupplierService`

**File:** `src/services/supplierService.ts`
**Used by:** Record Intake modal → **Supplier**.
**Tables:** `suppliers`.

```ts
export class SupplierService {
  static async list(): Promise<{ id; name }[]>
  static async findOrCreate(name: string): Promise<{ id: string; name: string }>
}
```

| Method | What it does |
| --- | --- |
| `list()` | All suppliers by name, e.g. for a `<datalist>` so the free-text field suggests existing names. |
| `findOrCreate(name)` | 1. Trim; empty → `ValidationError({ supplier: "Required" })`. 2. `insert(suppliers).values({ name }).onConflictDoNothing().returning()`. 3. If nothing came back (it already existed), select by name. Return `{ id, name }`. |

---

### 4.9 `TankService`

**File:** `src/services/tankService.ts`
**Used by:** Tankers → **Fuel tankers** scroller (`TankScroller`/`TankCard`) and its header total; **Add Tanker** modal; New Fuel Entry → **Drawn from tanker** select; Record Intake → **Tanker** select.
**Tables/views:** `tanks`, `v_tank_levels`, `tank_intakes`, `tank_dips`, `tank_period_balances`, `sites`, `audit_log`.

```ts
export class TankService {
  static async listWithLevels(filters?: { siteId?: string }): Promise<TankCardData[]>
  static async getTotals(): Promise<{ totalAvailableL: number; tankCount: number }>
  static async getById(id: string)
  static async listForSelect(): Promise<{ id; code; name; currentL: number | null; siteName }[]>
  static async create(input: CreateTankInput, actor: Actor): Promise<{ id: string; code: string }>
  static async update(id: string, input: Partial<Omit<CreateTankInput, "openingL">>, actor: Actor): Promise<void>
  static async archive(id: string, actor: Actor): Promise<void>
  static async getLatestUnitCost(tankId: string): Promise<number>
}

type TankCardData = { id; code; name; siteName; capacityL: number; currentL: number; fillPct: number; lastRefillAt: Date | null; level: "healthy" | "low" | "critical" };
type CreateTankInput = { code?: string; name: string; kind: "bulk" | "mobile_bowser" | "day_tank"; siteId: string; capacityL: number; openingL?: number };
```

| Method | Page / trigger | What it does |
| --- | --- | --- |
| `listWithLevels()` | Tankers → tank cards | Select from `vTankLevels` joined to `sites`. `currentL` = the running level (last dip + intake − issued since it); `measuredL` / `measuredAt` are the dip itself and `sinceDipL` the movement since. `level`: reuse `levelOf()` in `src/utils/tankUtils.tsx` so the cards keep their colours. Order by code. Replaces `fuelTanks` in sample data. The sample's `openingL`/`issuedL` fields belong to the reconciliation now; see `ReconciliationService`. |
| `getTotals()` | Tankers header ("22,140 L available across 7 tanks") | `sum(current_l)` and `count(*)` from `vTankLevels`. |
| `getById(id)` | internal / edit | `db.query.tanks.findFirst({ where: { id }, with: { site: true } })` → `NotFoundError("Tanker")`. |
| `listForSelect()` | Fuel entry & intake selects (`"Bulk Tanker A (7,250 L)"`) | Non-archived tanks with `currentL` from `vTankLevels`. |
| `create(input, actor)` | **Add Tanker** modal (fields: Tanker ID, Name, Site, Capacity, Opening level) | 1. Admin. 2. `capacityL > 0`; `openingL` between 0 and capacity. 3. Get the current period with `ReportingPeriodService.getCurrent()` **before** the batch. 4. `const id = crypto.randomUUID()`. 5. Batch: insert tank (`code` only if typed, else the sequence makes `TNK-##`) `returning({ id, code })`; **if `openingL` given**, insert a `tank_dips` row (`measuredL = openingL`, `measuredAt = now`, `recordedBy = actor.id`, `note: "Opening level"`) **and** a `tank_period_balances` row (`periodId`, `tankId: id`, `openingL`); audit. 6. Unique violation on code → `ConflictError`. |
| `update(id, input, actor)` | ⋯ → Edit | Admin. Capacity may not go below the current level. Audit. |
| `archive(id, actor)` | ⋯ → Archive | Admin. Refuse if the current level is above 0 (`ConflictError("Empty or transfer the fuel first.")`). Set `archivedAt`. Audit. |
| `getLatestUnitCost(tankId)` | internal (fuel entry cost snapshot) | 1. `cost_per_litre` of the newest `tank_intakes` row for this tank. 2. If none, the newest intake across **all** tanks. 3. If still none → `ValidationError("Record a fuel delivery before issuing fuel, so the cost can be calculated.")`. Return a number. |

---

### 4.10 `TankIntakeService`

**File:** `src/services/tankIntakeService.ts`
**Used by:** Tankers → **Record Intake** modal and **Intake log** table.
**Tables:** `tank_intakes`, `suppliers`, `tanks`, `v_tank_levels`, `users`.

```ts
export class TankIntakeService {
  static async list(filters?: { tankId?: string; from?: Date; to?: Date; limit?: number }): Promise<IntakeRow[]>
  static async getById(id: string)
  static async create(input: CreateIntakeInput, actor: Actor): Promise<{ id: string; code: string; totalCost: number }>
}

type IntakeRow = { id; code; tankId; tankName; supplier; deliveryNote; litres: number; costPerLitre: number; totalCost: number; receivedBy: string; receivedAt: Date };
type CreateIntakeInput = { tankId: string; supplierName: string; deliveryNote: string; litres: number; costPerLitre: number; receivedAt: Date; receivedById: string };
```

| Method | Page / trigger | What it does |
| --- | --- | --- |
| `list(filters)` | **Intake log** table | `db.query.tankIntakes.findMany({ with: { tank: true, supplier: true, receiver: true }, orderBy: { receivedAt: "desc" }, limit: filters.limit ?? 50 })`, with date filters as `receivedAt: { gte: from, lt: to }`. Map to `IntakeRow` (matches `TankerIntake` in `src/types/tank.ts`); `totalCost` comes from the generated column. |
| `create(input, actor)` | **Record Intake** modal (Tanker, Supplier, Delivery note, Quantity, Cost per litre, Date, Time, Received by) | 1. Admin. 2. `litres > 0`, `costPerLitre >= 0`, delivery note required. 3. `ReportingPeriodService.assertOpen(input.receivedAt)`. 4. Load the tank (not archived) and its current level from `vTankLevels`. **Capacity check:** `currentL + litres > capacityL` → `ValidationError({ litres: "This delivery would overfill the tanker (capacity 10,000 L, current 7,250 L)." })`. 5. `SupplierService.findOrCreate(supplierName)`. 6. Insert `returning({ id, code, totalCost })`. 7. `isUniqueViolation(e, "tank_intakes_supplier_delivery_note_key")` → `ConflictError("Delivery note DN-… is already recorded for this supplier.")`. **UI change needed:** "Received by" is a free-text name today (`currentUser.name`); make it a user `<select>` posting `receivedById`, defaulting to the signed-in user. |

---

### 4.11 `TankDipService`

**File:** `src/services/tankDipService.ts`
**Used by:** a **Record dip** action on Tankers (not built yet); `TankService`, `ReportingPeriodService`.
**Tables:** `tank_dips`, `tanks`.

```ts
export class TankDipService {
  static async record(input: { tankId: string; measuredL: number; measuredAt: Date; note?: string }, actor: Actor): Promise<void>
  static async listForTank(tankId: string, limit?: number)
  static async latest(tankId: string): Promise<{ measuredL: number; measuredAt: Date } | null>
}
```

| Method | What it does |
| --- | --- |
| `record(input, actor)` | 1. Admin. 2. `0 <= measuredL <= tank.capacityL`. 3. `measuredAt` not in the future. 4. Insert with `recordedBy: actor.id`. Dips drive the tank cards' level and the "measured" reconciliation column, so encourage one dip per tank per day. |
| `listForTank(tankId, limit = 30)` | Newest first, `with: { recorder: true }`. For a tank history drawer. |
| `latest(tankId)` | Newest single dip or `null`. |

---

### 4.12 `ReportingPeriodService`

**File:** `src/services/reportingPeriodService.ts`
**Used by:** Monthly Summary (month picker, **Close month**); Tankers reconciliation; `FuelEntryService` / `TankIntakeService` (block edits in closed months).
**Tables/views:** `reporting_periods`, `tank_period_balances`, `tanks`, `v_tank_reconciliation`, `audit_log`.

```ts
export class ReportingPeriodService {
  static async getOrCreate(month: string /* 'YYYY-MM-01' */): Promise<{ id: string; month: string; status: "open" | "closed" }>
  static async getCurrent(): Promise<{ id; month; status }>
  static async list(): Promise<{ id; month; status; closedAt: Date | null; closedByName: string | null }[]>
  static async assertOpen(at: Date): Promise<void>
  static async close(periodId: string, actor: Actor): Promise<void>
  static async reopen(periodId: string, actor: Actor): Promise<void>
}
```

| Method | What it does |
| --- | --- |
| `getOrCreate(month)` | `insert(reportingPeriods).values({ month }).onConflictDoNothing()`, then select by `month`. The DB check rejects anything but the 1st of a month. |
| `getCurrent()` | `getOrCreate(monthStart())`. |
| `list()` | Newest first, `with: { closer: true }`. Feeds the Monthly Summary month picker; the title "Monthly Summary — September 2024" comes from the selected month. |
| `assertOpen(at)` | Look up the period for `monthStart(at)`. If it exists and is `closed` → `ValidationError("September 2024 is closed. Ask an administrator to reopen it.")`. |
| `close(periodId, actor)` | 1. Admin. 2. The period must be `open` → otherwise `ConflictError`. 3. Read `vTankReconciliation` for the period. **Every tank needs a measured level:** list tanks with `measuredL === null` → `ValidationError("Record a closing dip for: Bulk Tanker A, …")`. 4. `const next = await getOrCreate(monthStart of month + 1)`. 5. Batch: for each tank, upsert `tank_period_balances(periodId, tankId)` with `openingL` (keep the existing value) and `closingMeasuredL = measuredL`; upsert the **next** period's balance with `openingL = measuredL` (`onConflictDoUpdate` on `[periodId, tankId]`); update the period to `status: "closed", closedBy: actor.id, closedAt: new Date()` (the check constraint needs both set); audit `period.close`. |
| `reopen(periodId, actor)` | 1. Admin. 2. Refuse if the **next** period is already closed. 3. Batch: `status: "open", closedBy: null, closedAt: null`; clear this period's `closingMeasuredL` values; audit `period.reopen`. The next month's opening values stay until the month is closed again. |

---

### 4.13 `ReconciliationService`

**File:** `src/services/reconciliationService.ts`
**Used by:** Tankers → **Stock reconciliation** table.
**Views:** `v_tank_reconciliation`.

```ts
export class ReconciliationService {
  static async getForPeriod(periodId: string): Promise<ReconciliationRow[]>
  static async getCurrent(): Promise<ReconciliationRow[]>
  static async getLossTotal(periodId: string): Promise<number>
}

type ReconciliationRow = {
  tankId; tankCode; name;
  openingL: number; intakeL: number; issuedL: number; expectedL: number;
  measuredL: number | null; varianceL: number | null; hasLoss: boolean;
};
```

| Method | What it does |
| --- | --- |
| `getForPeriod(periodId)` | `db.select().from(vTankReconciliation).where(eq(vTankReconciliation.periodId, periodId)).orderBy(vTankReconciliation.tankCode)`. Convert numerics. `hasLoss = varianceL !== null && varianceL < 0`. The page's `varianceTone()` in `src/utils/tankUtils.tsx` colours the cell. |
| `getCurrent()` | `getForPeriod((await ReportingPeriodService.getCurrent()).id)`. |
| `getLossTotal(periodId)` | Sum of negative `varianceL` values, as a positive number. Useful for a "Unexplained loss this month" tile. |

---

### 4.14 `AlertDetectionService`

**File:** `src/services/alertDetectionService.ts`
**Used by:** `FuelEntryService.create`, `FuelEntryCorrectionService.approve`.
**Tables:** none. **Pure functions**: everything they need is passed in, so they're easy to unit test offline without a database.

```ts
export type DetectionContext = {
  entry: {
    id: string; dispensedAt: Date; litres: number;
    totalKm: number | null; totalHours: number | null;
    odometerStart: number | null; hourMeterStart: number | null;
  };
  equipment: { id: string; code: string; typeName: string; siteId: string; basis: "hours" | "km"; lKmStandard: number | null; lHrStandard: number | null; fuelTankCapacityL: number | null };
  thresholds: Record<AlertSeverity, number>;
  /** Same equipment's entries before this one, newest first (last 24 h is enough). */
  previousEntries: { id: string; dispensedAt: Date; litres: number; odometerEnd: number | null; hourMeterEnd: number | null }[];
};

export type Finding = {
  rule: AlertRule; severity: AlertSeverity; variancePct: number | null; summary: string;
  /** Other fuel entries that are evidence, besides the new one. */
  relatedEntryIds: string[];
};

export class AlertDetectionService {
  static readonly REPEAT_TOP_UP_WINDOW_MINUTES = 60;

  static evaluate(ctx: DetectionContext): Finding[]
  static checkOverStandard(ctx: DetectionContext): Finding | null
  static checkExceedsTankCapacity(ctx: DetectionContext): Finding | null
  static checkRepeatTopUp(ctx: DetectionContext): Finding | null
  static checkNoMeterMovement(ctx: DetectionContext): Finding | null
  static entryStatusFor(findings: Finding[]): "locked" | "watch" | "flagged"
}
```

| Method | What it does |
| --- | --- |
| `evaluate(ctx)` | Run the four checks and return the non-null results. |
| `checkOverStandard` | 1. Pick the rate for the basis: `hours` → `litres / totalHours` against `lHrStandard`; `km` → `litres / totalKm` against `lKmStandard`. 2. Skip (`null`) when the distance/hours is 0 (that's `checkNoMeterMovement`) or the standard is missing. 3. `variancePct = (rate − std) / std × 100`, rounded to 2 dp. 4. `severity = AlertThresholdService.severityFor(variancePct, thresholds)`; `null` → no finding. 5. Summary: `"Consumption 18.9% above standard (14.9 vs 12.5 L/hr)."` **Optional:** average the last 3 fills (Σ litres ÷ Σ hours) so one bad reading doesn't raise an alert. Alerts like "…across three consecutive fills" come from this; put those entry ids in `relatedEntryIds`. |
| `checkExceedsTankCapacity` | If `fuelTankCapacityL` is set and `litres > fuelTankCapacityL` → severity **always `critical`**, `variancePct = (litres − cap) / cap × 100`, summary `"Refill of 480 L exceeds the unit's 400 L tank capacity."` |
| `checkRepeatTopUp` | Previous entries with `dispensedAt` within `REPEAT_TOP_UP_WINDOW_MINUTES` before this one. 1 match → `watch`; 2 or more → `high`. `relatedEntryIds` = their ids. Summary `"Two top-ups logged within 40 minutes."` (use the real gap). `variancePct: null`. |
| `checkNoMeterMovement` | `litres > 0` and the basis's total is `0` (`totalHours === 0` or `totalKm === 0`) → `high`, summary `"Fuel drawn without a matching hour meter movement."` Also worth flagging (`watch`): this entry's start reading is **below** the previous entry's end reading (meter rolled back). |
| `entryStatusFor(findings)` | No findings → `"locked"`. Any `high` or `critical` → `"flagged"`. Otherwise → `"watch"`. These are the Fuel Entry page's status pills. |

---

### 4.15 `FuelEntryService`

**File:** `src/services/fuelEntryService.ts`
**Used by:** Fuel Entry page (KPI tiles, filter tabs with counts, **My Recent Entries**), **New Fuel Entry** modal (Save Entry / Save & Add Another), Dashboard **Recent fuel log entries** and the "New Fuel Log Entry" button.
**Tables/views:** `fuel_entries`, `equipment`, `v_equipment_standards`, `tanks`, `operators`, `users`, `sites`, `theft_alerts`, `alert_fuel_entries`, `tank_intakes`, `reporting_periods`.

```ts
export class FuelEntryService {
  static async listRecent(options: { actor: Actor; status?: EntryStatus; limit?: number; before?: Date }): Promise<LogEntryRow[]>
  static async getSummary(options: { actor: Actor; since?: Date }): Promise<{ total: number; litres: number; flagged: number; watch: number; locked: number }>
  static async getById(id: string, actor: Actor): Promise<FuelEntryDetail>
  static validate(input: CreateFuelEntryInput, basis: "hours" | "km"): void
  static async create(input: CreateFuelEntryInput, actor: Actor): Promise<{ entry: { id: string; code: string; status: EntryStatus }; alerts: Finding[] }>
}

type LogEntryRow = { id; code; equipmentCode; status: EntryStatus; recordedBy: string; litres: number; siteName: string; dispensedAt: Date };
type CreateFuelEntryInput = {
  dispensedAt: Date; equipmentId: string; tankId: string; operatorId: string; litres: number;
  odometerStart: number | null; odometerEnd: number | null; hourMeterStart: number | null; hourMeterEnd: number | null;
  locationActivity: string;
};
```

| Method | Page / trigger | What it does |
| --- | --- | --- |
| `listRecent({ actor, status, limit, before })` | Fuel Entry → **My Recent Entries** (and the All / Flagged / Watch / Locked tabs); Dashboard → Recent entries | 1. Records taker: `where recordedBy = actor.id` ("My" entries). Admin: all entries. 2. Add `status` when a tab other than All is chosen. 3. `before` gives cursor paging (`dispensedAt < before`). 4. `db.query.fuelEntries.findMany({ with: { equipment: true, recorder: true, site: true }, orderBy: { dispensedAt: "desc" }, limit: limit ?? 50 })`. 5. Map to `LogEntryRow` (same fields as `LogEntry` in `src/types/fuelLog.ts`; format `dispensedAt` in the component). |
| `getSummary({ actor, since })` | Fuel Entry → 4 KPI tiles and the tab counts | One query with the same actor scoping: `count(*)`, `coalesce(sum(litres), 0)`, and `count(*) filter (where status = 'flagged' / 'watch' / 'locked')`, with `dispensedAt >= since` (the page hint says "Last 2 days"). "Needs review" = `flagged + watch`. |
| `getById(id, actor)` | Entry detail / correction form | `findFirst({ where: { id }, with: { equipment: { with: { type: true } }, tank: true, operator: true, recorder: true, site: true, alerts: true, corrections: { with: { requester: true, reviewer: true } } } })`. A records taker may only open entries they recorded → `ForbiddenError`. |
| `validate(input, basis)` | internal (also used when approving corrections) | Throw one `ValidationError` holding **all** field problems: `litres > 0`; `dispensedAt` not more than 5 minutes in the future; a meter pair is either fully filled or fully empty; `end >= start`; **the pair that matches the basis is required** (`km` → odometer, `hours` → hour meter); `locationActivity` required. |
| `create(input, actor)` | **New Fuel Entry** modal → Save Entry / Save & Add Another | **Reads:** 1. `EquipmentService.getById(input.equipmentId)`; status must be `active` or `idle`. 2. **Site:** records taker → `SessionService.assertSiteAccess(actor, equipment.siteId)` and `siteId = actor.siteId`; admin → `siteId = equipment.siteId`. 3. `validate(input, equipment.type.basis)`. 4. Load the tank (not archived) and its level from `vTankLevels`. Reject if `litres > capacityL`. If `litres > currentL`, **don't reject** (dips lag behind) but include a warning in the result. 5. `ReportingPeriodService.assertOpen(input.dispensedAt)`. 6. `unitCostGhs = await TankService.getLatestUnitCost(tankId)`. 7. The operator must exist and be active. 8. `EquipmentService.getEffectiveStandard`, `AlertThresholdService.getMap()`, and the equipment's entries from the last 24 h before `dispensedAt` (for repeat-top-up and meter-continuity checks). **Decide:** 9. `const id = crypto.randomUUID()`; compute `totalKm`/`totalHours` in code (the DB also generates them). 10. `findings = AlertDetectionService.evaluate(ctx)`; `status = AlertDetectionService.entryStatusFor(findings)`. **Write (one batch):** 11. Insert `fuel_entries` with `id`, `status`, `recordedBy: actor.id`, numerics via `toNumeric` (`.returning({ id, code, status })`). 12. For each finding, insert a `theft_alerts` row (pre-generated id, `equipmentId`, `siteId`, `rule`, `severity`, `variancePct`, `summary`, `detectedAt: new Date()`) and `alert_fuel_entries` rows for the new entry **and** every id in `relatedEntryIds`. 13. Return `{ entry, alerts: findings }`. The action shows `"LOG-2401 saved"` or `"LOG-2401 saved — flagged for review"`. **Save & Add Another** calls the same action and keeps the modal open, clearing only litres and readings. |

> Submitted entries are never edited directly. Corrections go through `FuelEntryCorrectionService`.

---

### 4.16 `FuelEntryCorrectionService`

**File:** `src/services/fuelEntryCorrectionService.ts`
**Used by:** Fuel Entry page → ⋯ on a row → **Request correction** (records takers); an admin **Pending corrections** list (new; could sit on the Dashboard or the Fuel Entry page for admins).
**Tables:** `fuel_entry_corrections`, `fuel_entries`, `theft_alerts`, `alert_fuel_entries`, `audit_log`.

```ts
export const CORRECTABLE_FIELDS = [
  "dispensedAt", "operatorId", "litres", "odometerStart", "odometerEnd", "hourMeterStart", "hourMeterEnd", "locationActivity",
] as const;
type CorrectableField = (typeof CORRECTABLE_FIELDS)[number];

export class FuelEntryCorrectionService {
  static async request(input: { fuelEntryId: string; changes: Partial<Record<CorrectableField, unknown>>; reason: string }, actor: Actor): Promise<{ id: string }>
  static async listPending(actor: Actor): Promise<PendingCorrectionRow[]>
  static async listForEntry(fuelEntryId: string, actor: Actor)
  static async approve(correctionId: string, actor: Actor): Promise<void>
  static async reject(correctionId: string, note: string, actor: Actor): Promise<void>
}
```

| Method | What it does |
| --- | --- |
| `request(input, actor)` | 1. Load the entry. A records taker may only correct entries they recorded; an admin may request on any. 2. Keep only keys in `CORRECTABLE_FIELDS`; equipment and tank can't be changed. Those need a new entry. 3. Build `changes` as `{ field: { from: currentValue, to: newValue } }`, dropping fields where the value didn't change. If nothing is left → `ValidationError("Nothing to change.")`. 4. `reason` required. 5. If a `pending` correction already exists for the entry → `ConflictError("A correction is already waiting for approval.")`. 6. `ReportingPeriodService.assertOpen(entry.dispensedAt)`. 7. Insert (`status` defaults to `pending`). |
| `listPending(actor)` | Admin. `findMany({ where: { status: "pending" }, with: { fuelEntry: { with: { equipment: true } }, requester: true }, orderBy: { createdAt: "asc" } })`. Show each `changes` entry as "Litres: 210 → 201". |
| `listForEntry(entryId, actor)` | History under an entry, newest first. Same access rule as `FuelEntryService.getById`. |
| `approve(correctionId, actor)` | 1. Admin. 2. Must be `pending` → otherwise `ConflictError`. 3. Optional rule: an admin can't approve their own request. 4. Build the corrected entry = current entry + every `to` value. 5. Re-run `FuelEntryService.validate(corrected, basis)`. 6. Re-run `AlertDetectionService.evaluate` → new `status`. 7. Batch: update `fuel_entries` with the new values and `status`; update the correction to `status: "approved", reviewedBy: actor.id, reviewedAt: new Date()` (the check constraint needs both); insert alerts for any **new** findings (don't delete old alerts, since they're history; admins resolve them); audit `fuel_entry.correct` with `before` = old entry values and `after` = new. 8. `assertOpen` on both the old and the new `dispensedAt`. |
| `reject(correctionId, note, actor)` | Admin. Must be `pending`. Batch: update to `status: "rejected"` with the reviewer fields; audit `fuel_entry.correction_rejected` with the note. |

---

### 4.17 `TheftAlertService`

**File:** `src/services/theftAlertService.ts`
**Used by:** Theft Alerts page (4 stat tiles, **Alert queue**, **Mark as read**, **Mark all as read**); sidebar **Theft Alerts** badge and the mobile menu dot; Dashboard **Anomaly watchlist** and "Flagged anomalies" tile.
**Tables:** `theft_alerts`, `alert_reads`, `alert_fuel_entries`, `fuel_entries`, `equipment`, `equipment_types`, `sites`, `users`, `audit_log`.

This replaces the in-browser store `src/utils/alertReadStore.ts`, which resets on refresh.

```ts
export class TheftAlertService {
  static async list(options: { userId: string; state?: AlertState; severity?: AlertSeverity; siteId?: string; limit?: number; before?: Date }): Promise<AlertRow[]>
  static async getCounts(): Promise<{ critical: number; high: number; watch: number; resolvedThisMonth: number; open: number }>
  static async getUnreadCount(userId: string): Promise<number>
  static async getById(alertId: string, userId: string): Promise<AlertDetail>
  static async markAsRead(alertId: string, userId: string): Promise<void>
  static async markAllAsRead(userId: string): Promise<void>
  static async markAsUnread(alertId: string, userId: string): Promise<void>
  static async startReview(alertId: string, actor: Actor): Promise<void>
  static async resolve(alertId: string, note: string, actor: Actor): Promise<void>
  static async reopen(alertId: string, actor: Actor): Promise<void>
  static async getWatchlist(limit?: number): Promise<{ id; equipmentCode; equipmentName; severity }[]>
}

type AlertRow = {
  id; code; equipmentId; equipmentCode; equipmentName; siteName; severity: AlertSeverity; state: AlertState;
  variancePct: number | null; summary: string; detectedAt: Date; isRead: boolean;
};
```

| Method | Page / trigger | What it does |
| --- | --- | --- |
| `list(options)` | **Alert queue** ("Newest first") | Needs a per-user join, so use the select builder: `db.select({...}).from(theftAlerts).innerJoin(equipment, …).innerJoin(equipmentTypes, …).innerJoin(sites, …).leftJoin(alertReads, and(eq(alertReads.alertId, theftAlerts.id), eq(alertReads.userId, userId)))`, with `isRead: sql<boolean>\`${alertReads.alertId} is not null\``, ordered by `desc(theftAlerts.detectedAt)`. `equipmentName` = the type name (the sample shows "Excavator A"; add a `name` column to `equipment` later if units need their own names). Resolved alerts always count as read in the UI. |
| `getCounts()` | 4 stat tiles; Dashboard "Flagged anomalies" (`open`) | One query: `count(*) filter (where severity='critical' and state <> 'resolved')`, same for `high` and `watch`, `count(*) filter (where state='resolved' and resolved_at >= <month start>)`, and `count(*) filter (where state <> 'resolved')` as `open`. |
| `getUnreadCount(userId)` | Sidebar badge + mobile menu dot | The query from `database-schema.md` §4.5 (left join `alert_reads`, `r.alert_id is null and a.state <> 'resolved'`). **Wire-up:** call it in `src/app/portal/layout.tsx` (admins only) and pass `unreadAlerts` into `<Sidebar>` as a prop instead of `useUnreadAlertCount()`. |
| `getById(alertId, userId)` | Alert detail | `findFirst({ with: { equipment: { with: { type: true } }, site: true, resolver: true, fuelEntries: { with: { recorder: true } } } })`, then `markAsRead(alertId, userId)` because opening an alert reads it. |
| `markAsRead(alertId, userId)` | **Mark as read** button | `insert(alertReads).values({ alertId, userId }).onConflictDoNothing()`. The action then calls `revalidatePath("/portal", "layout")` so the sidebar badge updates. |
| `markAllAsRead(userId)` | **Mark all as read** button | One statement: `insert into alert_reads (alert_id, user_id) select id, $userId from theft_alerts where state <> 'resolved' on conflict do nothing` (`db.execute(sql\`…\`)`, or `db.insert(alertReads).select(db.select({ alertId: theftAlerts.id, userId: sql<string>\`${userId}\`.as("user_id") }).from(theftAlerts).where(ne(theftAlerts.state, "resolved"))).onConflictDoNothing()`). Then revalidate the layout. |
| `markAsUnread` | optional ⋯ action | Delete the `alert_reads` row. |
| `startReview(alertId, actor)` | "Start review" (new) | Admin. `open → reviewing` only; otherwise `ConflictError`. Update `updatedAt`. |
| `resolve(alertId, note, actor)` | "Resolve" (new; "Resolving an alert records who cleared it") | 1. Admin. 2. Not already `resolved`. 3. `note` required. 4. Batch: `state: "resolved", resolvedBy: actor.id, resolvedAt: new Date(), resolutionNote: note` (the check constraint needs `resolvedBy` and `resolvedAt` together); audit `alert.resolve`. |
| `reopen(alertId, actor)` | ⋯ → Reopen | Admin. Must be `resolved`. Batch: `state: "open"`, set all three resolved fields to `null`; audit `alert.reopen`. |
| `getWatchlist(limit = 5)` | Dashboard **Anomaly watchlist** | Unresolved alerts ordered by severity rank (`case severity when 'critical' then 0 when 'high' then 1 else 2 end`), then newest. One row per equipment (`distinct on (equipment_id)`, or dedupe in code). |

---

### 4.18 `DashboardService`

**File:** `src/services/dashboardService.ts`
**Used by:** Dashboard page (4 animated tiles, **Daily fuel issuance** chart, **Consumption vs standard** chart, watchlist, recent entries, footer note).
**Views/tables:** `v_daily_issuance`, `v_monthly_equipment_summary`, `fuel_entries`, plus other services.

```ts
export class DashboardService {
  static async getKpis(month?: string): Promise<{ totalLitres: number; fuelCostGhs: number; avgCostPerLitre: number; activeEquipment: number; idleOrMaintenance: number; openAlerts: number; registeredUnits: number }>
  static async getDailyIssuance(range: { from: Date; to: Date; siteId?: string }): Promise<{ date: string; litres: number }[]>
  static async getConsumptionComparison(periodId: string, limit?: number): Promise<{ equipment: string; actual: number; standard: number }[]>
  static async getOverview(actor: Actor): Promise<DashboardOverview>
}
```

| Method | What it does |
| --- | --- |
| `getKpis(month)` | 1. Month range from `month ?? monthStart()`. 2. From `fuel_entries` in range: `sum(litres)` and `sum(litres * unit_cost_ghs)`. `avgCostPerLitre = cost / litres` (the tile hint "@ GHS 3.50/L"; guard against divide by 0). 3. `EquipmentService.getStats()` → `active`, `idle + maintenance`, and `total` for the footer note. 4. `TheftAlertService.getCounts().open`. |
| `getDailyIssuance({ from, to, siteId })` | 1. Select from `vDailyIssuance` where `day` between the dates (sum across sites unless `siteId` given; group by `day`). 2. **Fill missing days with 0 in code** so the line chart has no gaps. 3. Label with `shortDate` ("Sep 1"). Matches `DailyIssuancePoint`. Default range: last 11 days. |
| `getConsumptionComparison(periodId, limit = 6)` | From `vMonthlyEquipmentSummary`: `periodId`, `basis = 'hours'`, `litres > 0`. `equipment` = type name + code, `actual = avgLPerHr`, `standard = lHrStandard`. Order by variance descending. Matches `ConsumptionComparison`. |
| `getOverview(actor)` | Admin. Runs everything the page needs in parallel with `Promise.all([getKpis(), getDailyIssuance(...), ReportingPeriodService.getCurrent().then(p => getConsumptionComparison(p.id)), TheftAlertService.getWatchlist(), FuelEntryService.listRecent({ actor, limit: 6 })])` and returns one object, so the page makes one call. |

---

### 4.19 `MonthlySummaryService`

**File:** `src/services/monthlySummaryService.ts`
**Used by:** Monthly Summary page (3 stat tiles, **Per-equipment breakdown**, **Export CSV**, **Generate report**, row selection → Export).
**Views:** `v_monthly_equipment_summary`, `sites`.

```ts
export class MonthlySummaryService {
  static async getRows(periodId: string, filters?: { siteId?: string; equipmentIds?: string[] }): Promise<MonthlySummaryRow[]>
  static async getTotals(periodId: string): Promise<{ totalLitres: number; totalCostGhs: number; flaggedUnits: number }>
  static async toCsv(periodId: string, equipmentIds?: string[]): Promise<string>
}
```

| Method | What it does |
| --- | --- |
| `getRows(periodId, filters)` | Select from `vMonthlyEquipmentSummary` joined to `sites`, ordered by `equipmentCode`. Map to the existing `MonthlySummaryRow` type (`src/types/monthly.ts`): `qtyL = litres`, `km = totalKm`, `hours = totalHours`, `lKmAvg = avgLPerKm`, `lHrAvg = avgLPerHr`, `lKmStd`/`lHrStd`, and **split `variancePct` by basis**: `varLKm` when `basis = 'km'`, `varLHr` when `hours`, the other `null`. `costGhs = costGhs`, `status = status`. `equipmentIds` limits it to selected rows. |
| `getTotals(periodId)` | `sum(litres)`, `sum(cost_ghs)`, `count(*) filter (where status <> 'normal')` from the view. |
| `toCsv(periodId, equipmentIds)` | `getRows`, then build the CSV with the same headers as the table: `Equipment, Type, Site, Qty (L), Km, Hours, Consumption avg, Standard, Variance %, Cost (GHS), Status`. Quote every value and double any `"` inside it. **Serve it** from a Route Handler, not a server action: `src/app/portal/(admin)/monthly_summary/export/route.ts` → `GET` calls `SessionService.requireAdmin()` and `toCsv`, then returns `new Response(csv, { headers: { "Content-Type": "text/csv", "Content-Disposition": 'attachment; filename="fuelguard-2024-09.csv"' } })`. The **Export CSV** button links to `/portal/monthly_summary/export?period=<id>`. **Generate report** (PDF) is out of scope for now. |

---

### 4.20 `AuditLogService`

**File:** `src/services/auditLogService.ts`
**Used by:** every service that changes important data; a record-history panel later.
**Tables:** `audit_log`.

```ts
export const AUDIT_ACTIONS = {
  userCreate: "user.create", userRoleChange: "user.role_change", userStatusChange: "user.status_change", userPasswordSet: "user.password_set",
  standardCreate: "standard.create", standardUpdate: "standard.update", thresholdUpdate: "threshold.update",
  equipmentCreate: "equipment.create", equipmentUpdate: "equipment.update", equipmentStatusChange: "equipment.status_change",
  tankCreate: "tank.create", tankUpdate: "tank.update", tankArchive: "tank.archive",
  fuelEntryCorrect: "fuel_entry.correct", fuelEntryCorrectionRejected: "fuel_entry.correction_rejected",
  alertResolve: "alert.resolve", alertReopen: "alert.reopen",
  periodClose: "period.close", periodReopen: "period.reopen",
} as const;

export class AuditLogService {
  static entry(actorId: string | null, action: string, entityType: string, entityId: string, before: unknown, after: unknown)
  static async record(actorId: string | null, action: string, entityType: string, entityId: string, before: unknown, after: unknown): Promise<void>
  static async listForEntity(entityType: string, entityId: string, limit?: number)
}
```

| Method | What it does |
| --- | --- |
| `entry(...)` | **Returns the insert query without `await`**: `return db.insert(auditLog).values({ actorId, action, entityType, entityId, before, after })`. Drop it straight into a `db.batch([...])` next to the change it describes. |
| `record(...)` | `await AuditLogService.entry(...)` for one-off logging outside a batch. |
| `listForEntity(entityType, entityId, limit = 50)` | `findMany({ where: { entityType, entityId }, with: { actor: true }, orderBy: { createdAt: "desc" }, limit })`. |

Never put password hashes or `AUTH_SECRET`-derived values in `before`/`after`.

---

## 5. Page → service map

What each page calls on load, and what each button calls.

| Page / component | On load (server component) | Buttons / forms (server actions) |
| --- | --- | --- |
| **Login** `auth/login` | — | Sign in → `src/app/auth/actions.ts` `login` (done; can call `UserService.verifyCredentials`) |
| **Portal layout / Sidebar** | `SessionService.getActor()`; `TheftAlertService.getUnreadCount(actor.id)` for admins → `<Sidebar unreadAlerts>` | Sign out → `logout` (done) |
| **Dashboard** `(admin)/dashboard` | `DashboardService.getOverview(actor)` | New Fuel Log Entry → same action as Fuel Entry |
| **Fuel Entry** `fuel_entry` | `FuelEntryService.getSummary({ actor, since: 2 days ago })`, `FuelEntryService.listRecent({ actor, status })` | Filter tabs → re-query with `status` (search param `?status=flagged`); ⋯ → Request correction → `FuelEntryCorrectionService.request` |
| **New Fuel Entry modal** | `EquipmentService.listForEntryForm(actor)`, `TankService.listForSelect()`, `OperatorService.listActive({ siteId })` (load in the page, pass as props) | Save Entry / Save & Add Another → `FuelEntryService.create` |
| **Tankers** `(admin)/tankers` | `TankService.listWithLevels()`, `TankService.getTotals()`, `ReconciliationService.getCurrent()`, `TankIntakeService.list({ limit: 50 })` | Add Tanker → `TankService.create`; Record Intake → `TankIntakeService.create`; Record dip → `TankDipService.record`; ⋯ → `TankService.update` / `archive` |
| **Record Intake modal** | `TankService.listForSelect()`, `SupplierService.list()`, `UserService.listAccounts({ role: "administrator", status: "active" })` | → `TankIntakeService.create` |
| **Monthly Summary** `(admin)/monthly_summary` | `ReportingPeriodService.list()` (picker), `MonthlySummaryService.getTotals(periodId)`, `MonthlySummaryService.getRows(periodId)` | Export CSV → Route Handler + `MonthlySummaryService.toCsv`; Close month → `ReportingPeriodService.close`; Reopen → `reopen` |
| **Theft Alerts** `(admin)/theft_alerts` | `TheftAlertService.getCounts()`, `TheftAlertService.list({ userId: actor.id })` | Mark as read → `markAsRead`; Mark all as read → `markAllAsRead`; Start review → `startReview`; Resolve → `resolve`; Reopen → `reopen` |
| **Equipment & Vehicles** `(admin)/equipment_and_vehicles` | `EquipmentService.getStats()`, `EquipmentService.list()` | Add Equipment → `EquipmentService.create` (modal selects: `EquipmentTypeService.list()`, `SiteService.list()`); ⋯ → `update` / `setStatus` / `moveToSite` |
| **Consumption Standards** `(admin)/consumption_standards` | `AlertThresholdService.list()`, `EquipmentTypeService.list()` | Edit thresholds → `AlertThresholdService.update`; ⋯ on a type → `EquipmentTypeService.updateStandard` / `remove` |
| **Users & Roles** `(admin)/users_and_roles` | `UserService.getStats()`, `UserService.listAccounts()` | Create New User → `UserService.create` (site select: `SiteService.list()`); ⋯ → `updateProfile` / `changeRole` / `setStatus` / `setPassword` |
| **Selection bar "Delete"** (every table) | — | Most records must **not** be deleted (see each service). Swap Delete for the matching archive / disable / retire action, and keep **Export** where it makes sense. |

After every write, revalidate the page that shows the data:

| Write | `revalidatePath` |
| --- | --- |
| Fuel entry, correction | `/portal/fuel_entry`, `/portal/dashboard` |
| Alert read / resolve | `/portal/theft_alerts`, and `("/portal", "layout")` for the sidebar badge |
| Intake, dip, tank | `/portal/tankers` |
| Equipment, type, threshold | `/portal/equipment_and_vehicles`, `/portal/consumption_standards` |
| User | `/portal/users_and_roles` |
| Period close/reopen | `/portal/monthly_summary`, `/portal/tankers` |

---

## 6. Drizzle cheat sheet for this project

Versions: `drizzle-orm` / `drizzle-kit` **1.0.0-rc.4**, driver `drizzle-orm/neon-http`. Import the client from `@/db` and tables from `@/db/schema`.

### 6.1 Relational queries (`db.query`)

Filters are **plain objects**, not functions (this is the v1 API):

```ts
const rows = await db.query.fuelEntries.findMany({
  columns: { id: true, code: true, litres: true, dispensedAt: true, status: true },
  where: {
    recordedBy: actor.id,
    status: { in: ["flagged", "watch"] },
    dispensedAt: { gte: since },
    OR: [{ siteId: actor.siteId! }, { siteId: { isNull: true } }],
  },
  with: { equipment: { columns: { code: true } }, recorder: { columns: { name: true } } },
  orderBy: { dispensedAt: "desc" },
  limit: 50,
});

const one = await db.query.users.findFirst({ where: { id }, columns: { passwordHash: false } });
```

Operators you can use inside a field: `eq, ne, gt, gte, lt, lte, in, notIn, like, ilike, notLike, notIlike, isNull: true, isNotNull: true`, plus `OR`, `AND`, `NOT`, and `RAW` for custom SQL:

```ts
where: { RAW: (t) => sql`lower(${t.email}) = lower(${email})` }
```

**Relation names** (from `src/db/relations.ts`). They can't match column names, which is why several end in `-er`:

| Table | Relations |
| --- | --- |
| `users` | `site`, `inviter`, `invitees`, `operator`, `recordedFuelEntries`, `receivedIntakes`, `tankDips`, `requestedCorrections`, `reviewedCorrections`, `resolvedAlerts`, `alertReads`, `auditLog` |
| `sites` | `users`, `operators`, `equipment`, `tanks`, `fuelEntries`, `theftAlerts` |
| `operators` | `site`, `user`, `fuelEntries` |
| `equipmentTypes` | `equipment` |
| `equipment` | `type`, `site`, `fuelEntries`, `theftAlerts` |
| `alertThresholds` | `updater` |
| `tanks` | `site`, `intakes`, `dips`, `periodBalances`, `fuelEntries` |
| `suppliers` | `intakes` |
| `tankIntakes` | `tank`, `supplier`, `receiver` |
| `tankDips` | `tank`, `recorder` |
| `reportingPeriods` | `closer`, `tankBalances` |
| `tankPeriodBalances` | `period`, `tank` |
| `fuelEntries` | `equipment`, `tank`, `operator`, `site`, `recorder`, `corrections`, `alerts` (through `alert_fuel_entries`) |
| `fuelEntryCorrections` | `fuelEntry`, `requester`, `reviewer` |
| `theftAlerts` | `equipment`, `site`, `resolver`, `fuelEntries` (through `alert_fuel_entries`), `reads` |
| `alertFuelEntries` | `alert`, `fuelEntry` |
| `alertReads` | `alert`, `user` |
| `auditLog` | `actor` |

### 6.2 Select builder (joins, aggregates, views)

```ts
import { and, count, desc, eq, gte, sql, sum } from "drizzle-orm";

// Views have no relations — join them yourself
const tanks = await db
  .select({ id: vTankLevels.tankId, name: vTankLevels.name, currentL: vTankLevels.currentL, siteName: sites.name })
  .from(vTankLevels)
  .innerJoin(sites, eq(sites.id, vTankLevels.siteId))
  .orderBy(vTankLevels.tankCode);

// Several counts in one round trip
const [stats] = await db
  .select({
    total: count(),
    litres: sql<string>`coalesce(sum(${fuelEntries.litres}), 0)`,
    flagged: sql<number>`count(*) filter (where ${fuelEntries.status} = 'flagged')`.mapWith(Number),
  })
  .from(fuelEntries)
  .where(and(eq(fuelEntries.recordedBy, actor.id), gte(fuelEntries.dispensedAt, since)));

// Simple count
const openAlerts = await db.$count(theftAlerts, sql`${theftAlerts.state} <> 'resolved'`);
```

### 6.3 Insert / update / upsert

```ts
// Insert and get generated values back (code, generated totals)
const [row] = await db.insert(tankIntakes).values({ ...values, litres: toNumeric(5000) }).returning({ id: tankIntakes.id, code: tankIntakes.code, totalCost: tankIntakes.totalCost });

// Ignore duplicates
await db.insert(alertReads).values({ alertId, userId }).onConflictDoNothing();

// Upsert
await db.insert(alertThresholds).values({ level: "watch", percent: "5" })
  .onConflictDoUpdate({ target: alertThresholds.level, set: { percent: "5", updatedBy: actor.id, updatedAt: new Date() } });

// Update — updatedAt is set automatically by $onUpdate in the schema
await db.update(theftAlerts).set({ state: "reviewing" }).where(eq(theftAlerts.id, alertId));
```

Never write to generated columns: `total_cost`, `total_km`, `total_hours`, `l_per_km`, `l_per_hr`. Leave `code` out unless the user typed one.

### 6.4 Batch (atomic multi-write)

```ts
const results = await db.batch([
  db.update(theftAlerts).set({ state: "resolved", resolvedBy: actor.id, resolvedAt: new Date(), resolutionNote: note }).where(eq(theftAlerts.id, alertId)),
  AuditLogService.entry(actor.id, AUDIT_ACTIONS.alertResolve, "theft_alerts", alertId, before, { state: "resolved", note }),
]);
// results[i] is the result of query i (the returning() rows for inserts that use it)
```

### 6.5 Constraint names worth catching

| Constraint | Friendly message |
| --- | --- |
| `users_email_lower_key` | An account with that email already exists. |
| `tank_intakes_supplier_delivery_note_key` | That delivery note is already recorded for this supplier. |
| `equipment_code_key` / `equipment_registration_no_key` | That equipment ID / registration is already used. |
| `tanks_code_key`, `sites_code_key`, `equipment_types_name_key`, `suppliers_name_key` | That code / name is already used. |
| `equipment_types_standard_matches_basis` | Set the L/km standard for odometer types, or L/hr for hour-meter types. |
| `fuel_entries_has_meter_reading` | Enter the start and end meter readings. |
| `fuel_entries_hour_meter_order` / `fuel_entries_odometer_order` | End reading can't be lower than start. |
| `theft_alerts_resolved_consistent` | (bug in code) resolvedBy and resolvedAt must be set together. |
| `users_records_taker_has_site` | Records takers must be assigned to a site. |

Unique columns declared with `.unique()` get Postgres's default name `<table>_<column>_key`.

### 6.6 Useful commands

| Command | What it does |
| --- | --- |
| `yarn db:generate` | Create a migration after editing `src/db/schema.ts` |
| `yarn db:migrate` | Apply migrations to the database in `DATABASE_URL` |
| `yarn db:studio` | Browse the data in Drizzle Studio (needs internet for Neon) |
| `SEED_PASSWORD='…' yarn db:seed` | Sites, demo accounts, alert thresholds |
| `npx tsc --noEmit` | Type-check everything (works offline) |

> **Working fully offline:** Neon needs internet. To run queries offline, point a scratch script at an in-memory Postgres with `@electric-sql/pglite` + `drizzle-orm/pglite`, apply `drizzle/*/migration.sql`, and test services against it. `AlertDetectionService` has no database calls at all, so it can be built and tested with no setup.

---

## 7. Suggested build order

Each step only depends on the ones before it.

1. `errors.ts`, `types.ts`, `utils.ts`, `SessionService`, `AuditLogService`
2. `SiteService`, `AlertThresholdService`, `EquipmentTypeService`
3. `UserService`, `OperatorService`, `SupplierService`
4. `EquipmentService`, `ReportingPeriodService`
5. `TankService`, `TankDipService`, `TankIntakeService`, `ReconciliationService`
6. `AlertDetectionService` (pure; write small tests for each check)
7. `FuelEntryService`, then `FuelEntryCorrectionService`
8. `TheftAlertService` (then remove `src/utils/alertReadStore.ts` and pass the count into the sidebar)
9. `DashboardService`, `MonthlySummaryService`
10. Swap each page's `sampleData` import for the service calls in §5, one page at a time
