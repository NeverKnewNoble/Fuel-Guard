# FuelGuard — Data Fetching with TanStack Query

How pages load data from the services in `src/services/`, keep it cached on the client, and refresh it after a change. Read [`services.md`](./services.md) first for the services themselves.

**Contents**

1. [How the pieces fit](#1-how-the-pieces-fit)
2. [Files](#2-files)
3. [Reads: API route → query → component](#3-reads-api-route--query--component)
4. [Server prefetch and hydration](#4-server-prefetch-and-hydration)
5. [Writes: server action → mutation → invalidate](#5-writes-server-action--mutation--invalidate)
6. [Loading, empty and error states](#6-loading-empty-and-error-states)
7. [Query keys and caching](#7-query-keys-and-caching)
8. [Adding a page: checklist](#8-adding-a-page-checklist)
9. [Rollout plan](#9-rollout-plan)

---

## 1. How the pieces fit

```
                     ┌──────────── first request ────────────┐
Page (server)  ──prefetch()────▶  Service.method()  ──▶  Drizzle
      │                              (direct call, no HTTP)
      └─ <HydrationBoundary state={dehydrate(queryClient)}>
               │
Client component ──useQuery──▶ cache hit (hydrated) ──────── no request
               │
               └── later: stale / window focus / invalidated
                        │
                        ▼
               fetch("/api/…")  ──▶  route.ts  ──▶  Service.method()

Form in a modal ──useMutation──▶ server action ──▶ Service.method()
               └─ onSettled: invalidateQueries(keys) ──▶ the queries above refetch
```

| Concern | Uses | Why |
| --- | --- | --- |
| **Reading data** | `GET` route handlers under `src/app/api/` | TanStack Query caches and refetches them. Next.js runs route handlers in parallel; it runs server actions one at a time, so they're a poor fit for reads. |
| **Changing data** | Server actions (`actions.ts`) called by `useMutation` | Built-in CSRF protection, and no extra API surface for writes. |
| **First paint** | Server prefetch + `HydrationBoundary` | The page arrives with data already in the cache: no spinner, no extra round trip. |
| **Navigation** | `loading.tsx` skeleton per route | Shows while the server prefetches. |

---

## 2. Files

| File | Runs on | What it holds |
| --- | --- | --- |
| `src/components/providers/queryProvider.tsx` | client | `QueryClientProvider` + devtools. Wraps everything in `src/app/portal/layout.tsx`. |
| `src/queries/queryClient.ts` | both | `getQueryClient()`: a new client per server render, one shared client in the browser. Default `staleTime` and retry rules. `prefetch(queryClient, options)` warms the cache for a server render (TanStack deprecated `prefetchQuery` in favour of `query`, which throws, so this swallows errors). |
| `src/queries/apiFetch.ts` | client | `apiFetch<T>(path)` for `queryFn`s. Throws `ApiError` (message, status, code, fields). Turns ISO date strings back into `Date`. |
| `src/queries/keys.ts` | both | `queryKeys`: every query key. |
| `src/queries/<area>Queries.ts` | both | `queryOptions` per resource (key + client `queryFn`). |
| `src/queries/<area>Mutations.ts` | client | `useXxx()` mutation hooks: which action, which keys to invalidate. |
| `src/queries/useActionMutation.ts` | client | Wraps a server action as a mutation, toasts failures with its `errorTitle`, and exposes `fieldErrors()` for the inputs at fault. |
| `src/app/api/_lib/routeHandler.ts` | server | `withActor(handler, { admin })`: session check, JSON response, `ServiceError` → HTTP status. |
| `src/app/api/_lib/params.ts` | server | `uuidParam(id, what)`: a malformed `[id]` becomes a 404 instead of a Postgres error (500). Use it in every `[id]` route. |
| `src/app/api/<resource>/route.ts` | server | One `GET` per resource, calling a service. |
| `src/app/portal/**/actions.ts` | server | `"use server"` write actions returning `ActionState`. |
| `src/utils/actionUtils.ts` | server | Helpers for actions: `toErrorState`, `formText`, `optionalText`, `requiredNumber`, `optionalNumber`, `oneOf`, `accraDateTime(date, time)` (a date input + time input as an Accra-time `Date`). |
| `src/utils/formatDate.ts` | both | `formatDateTime`, `formatShortDateTime`, and `dateTimeInputValues()` to default date/time inputs to "now" in Accra time. |
| `src/components/ui/rowActions.tsx` | client | ⋯ menu. Pass `items` (label, icon, `onSelect`, `tone: "danger"`, `hidden`, `separated`) for anything beyond Edit / Delete. The menu is `position: fixed`, so `overflow` on tables and scrollers can't clip it; it opens upwards near the bottom of the screen and closes on scroll. |
| `src/components/modals/confirmDialog.tsx` | client | "Are you sure?" for one-click actions (retire, disable, close month), with pending and error states. |
| `src/components/ui/selection.tsx` | client | `SelectionBar` takes `onDelete` / `onExport`, each called with the selected ids and a `clear()`. |

### API routes so far

| Route | Service call | Admin only |
| --- | --- | --- |
| `GET /api/alert_thresholds` | `AlertThresholdService.listIfConfigured()` | yes |
| `GET /api/equipment_types` | `EquipmentTypeService.list()` | yes |
| `GET /api/me` | The signed-in user plus their default site's name, for forms that fill it in | no |
| `GET /api/sites` | `SiteService.list()` — non-archived, for "Site" selects | no |
| `GET /api/sites/usage` | `SiteService.listWithUsage()` — the Sites page, archived included | yes |
| `GET /api/operators/all` | `OperatorService.list({ includeInactive: true })` — the Operators page | yes |
| `GET /api/equipment` | `EquipmentService.list()` | yes |
| `GET /api/equipment/stats` | `EquipmentService.getStats()` | yes |
| `GET /api/equipment/[id]` | `EquipmentService.getById(id)` (404 for a malformed id) | yes |
| `GET /api/users` | `UserService.listAccounts()` | yes |
| `GET /api/users/stats` | `UserService.getStats()` | yes |
| `GET /api/tanks` | `TankService.listWithLevels()` | yes |
| `GET /api/tanks/options` | `TankService.listForSelect()` (also for New Fuel Entry) | no |
| `GET /api/tanks/[id]` | `TankService.getById(id)` | yes |
| `GET /api/tanks/[id]/dips` | `TankDipService.listForTank(id)` | yes |
| `GET /api/reconciliation` | `ReconciliationService.getCurrentReport()` (rows + month + total loss) | yes |
| `GET /api/intakes` | `TankIntakeService.list({ limit: 50 })` | yes |
| `GET /api/suppliers` | `SupplierService.list()` | yes |
| `GET /api/fuel_entries?status=` | `FuelEntryService.listRecent({ actor, status })` (a records taker only gets their own) | no |
| `GET /api/fuel_entries/summary` | `FuelEntryService.getSummary()` over the last 2 days | no |
| `GET /api/fuel_entries/[id]` | `FuelEntryService.getById(id, actor)` | no |
| `GET /api/equipment/options` | `EquipmentService.listForEntryForm(actor)` | no |
| `GET /api/operators` | `OperatorService.listActive()`, scoped to a records taker's site | no |
| `GET /api/corrections/pending` | `FuelEntryCorrectionService.listPending()` | yes |
| `GET /api/alerts?state=` | `TheftAlertService.list({ userId })` (with this user's read state) | yes |
| `GET /api/alerts/counts` | `TheftAlertService.getCounts()` | yes |
| `GET /api/alerts/unread_count` | `TheftAlertService.getUnreadCount(userId)` — the sidebar badge | yes |
| `GET /api/reporting_periods` | `ReportingPeriodService.list()` | yes |
| `GET /api/monthly_summary/[periodId]` | `MonthlySummaryService.getReport(periodId)` (rows + totals) | yes |
| `GET /api/dashboard` | `DashboardService.getOverview(actor)` (KPIs, charts, watchlist, recent entries) | yes |

**Not API routes — the two CSV downloads.** Each is a Route Handler next to its page that returns the file with `Content-Disposition`, so the browser saves it. Both check the session themselves and return plain text on failure, since nothing reads them as JSON:

| Route | Returns | Who |
| --- | --- | --- |
| `GET /portal/monthly_summary/export?period=<id>&equipment=<id>…` | the month's per-equipment breakdown, all rows or only the selected ones | `requireAdmin()` |
| `GET /portal/fuel_entry/export?status=<tab>&id=<uuid>…` | the daily fuel log, one row per entry with both meters, totals and consumption | `requireUser()` — scoped by actor, so a records taker only exports their own entries |

Folder names under `src/app/api/` use snake_case, like the portal routes (`/api/equipment_types`). The `_lib` folder is private: Next.js never serves it as a route.

---

## 3. Reads: API route → query → component

### 3.1 Route handler

```ts
// src/app/api/equipment_types/route.ts
import { withActor } from "@/app/api/_lib/routeHandler";
import { EquipmentTypeService } from "@/services/equipmentTypeService";

export const GET = withActor(() => EquipmentTypeService.list(), { admin: true });
```

`withActor`:

- calls `SessionService.requireUser()`, or `requireAdmin()` with `{ admin: true }`. The proxy doesn't cover `/api`, so this is the only guard.
- passes `{ actor, request, context }` to your handler. Read search params from `new URL(request.url).searchParams`, and dynamic segments from `await context.params`.
- returns the result with `Cache-Control: private, no-store`. Caching happens in TanStack Query, never in a browser or proxy.
- maps errors to statuses:

| Error | Status |
| --- | --- |
| `UnauthorizedError` | 401 |
| `ForbiddenError` | 403 |
| `NotFoundError` | 404 |
| `ConflictError` | 409 |
| `ValidationError` | 422 (with `fields`) |
| other `ServiceError` | 400 |
| anything else | 500, generic message; details logged on the server |

Services still check permissions themselves (see `services.md` §2.2). `admin: true` is a second, earlier check.

With a filter or a dynamic segment:

```ts
// src/app/api/fuel_entries/route.ts  →  /api/fuel_entries?status=flagged
export const GET = withActor(({ actor, request }) => {
  const status = new URL(request.url).searchParams.get("status") ?? undefined;
  return FuelEntryService.listRecent({ actor, status: status as EntryStatus | undefined });
});

// src/app/api/equipment/[id]/route.ts
export const GET = withActor<RouteContext<"/api/equipment/[id]">>(async ({ context }) => {
  const { id } = await context.params;
  return EquipmentService.getById(id);
}, { admin: true });
```

### 3.2 Query options

```ts
// src/queries/standardsQueries.ts
export const equipmentTypesQuery = () =>
  queryOptions({
    queryKey: queryKeys.standards.equipmentTypes(),
    queryFn: () => apiFetch<EquipmentTypeRow[]>("/api/equipment_types"),
  });
```

Type the `apiFetch` result with the service's return type from `src/types/`. `apiFetch` turns dates back into `Date` objects, so the types match.

### 3.3 Component

```tsx
"use client";
const query = useQuery(equipmentTypesQuery());
```

See §6 for loading, empty and error states.

---

## 4. Server prefetch and hydration

Pages stay server components. They prefetch with the **same key**, but call the service directly instead of going through HTTP:

```tsx
// src/app/portal/(admin)/consumption_standards/page.tsx
export default async function ConsumptionStandardsPage() {
  const queryClient = getQueryClient();
  await Promise.all([
    prefetch(queryClient, { ...thresholdsQuery(), queryFn: () => AlertThresholdService.listIfConfigured() }),
    prefetch(queryClient, { ...equipmentTypesQuery(), queryFn: () => EquipmentTypeService.list() }),
  ]);

  return (
    <>
      <PageHeader … />
      <HydrationBoundary state={dehydrate(queryClient)}>
        <ThresholdsCard />
        <EquipmentTypesCard />
      </HydrationBoundary>
    </>
  );
}
```

Rules:

- **Same key, different `queryFn`.** Spread the query options, then override `queryFn`. If the keys differ, the client won't find the prefetched data and will fetch again.
- **Services that need an actor:** get it with `await SessionService.requireUser()` in the page. The layouts have already redirected anyone signed out.
- **Prefetch never throws.** A failed prefetch leaves that query empty; the client component fetches it and shows `ErrorState` if it fails again. Don't wrap prefetches in try/catch.
- **Everything the client reads must be prefetched**, or it shows a skeleton while it fetches.
- **Dates:** prefetched data crosses to the client through React's serializer, which keeps `Date` objects. Data from `/api` gets them back from `apiFetch`. Components always receive `Date`.

---

## 5. Writes: server action → mutation → invalidate

### 5.1 Server action

Actions take the form's `FormData` and return `ActionState` (`src/types/actions.ts`). They don't call `revalidatePath`: the mutation hook refreshes the affected queries instead.

```ts
// src/app/portal/(admin)/consumption_standards/actions.ts
"use server";

export async function updateStandardAction(formData: FormData): Promise<ActionState> {
  try {
    const actor = await SessionService.requireUser();   // inside the try, so "sign in again" reaches the form
    await EquipmentTypeService.updateStandard(String(formData.get("id") ?? ""), { … }, actor);
    return { ok: true, message: "Standard updated." };
  } catch (error) {
    return toErrorState(error);                          // ServiceError → { ok: false, error, fields }; anything else rethrows
  }
}
```

### 5.2 Mutation hook

```ts
// src/queries/standardsMutations.ts
"use client";

const typeKeys = [queryKeys.standards.equipmentTypes(), queryKeys.equipment.all];

export const useUpdateStandard = () => useActionMutation({ action: updateStandardAction, invalidates: typeKeys });
```

`useActionMutation`:

- turns `{ ok: false }` into a thrown `ActionError`, so `mutation.error` covers validation messages and crashes alike.
- invalidates the keys in `onSettled` (after success **and** failure), since a partly failed action, like a bulk delete, may still have changed data.

List every key whose data the write can change: the resource itself **plus** anything derived from it. For example, a new fuel entry changes the entry list, the summary tiles, the alerts, the tank levels and the dashboard.

### 5.3 Form

```tsx
const mutation = useUpdateStandard();
const errors = fieldErrors(mutation.error);

<form
  onSubmit={(event) => {
    event.preventDefault();
    mutation.mutate(new FormData(event.currentTarget), {
      onSuccess: (result) => {
        toast.success("Saved", { description: result.message });
        onClose();
      },
    });
  }}
>
  <Field label="L/hr standard" htmlFor="type-standard" error={errors?.lHrStandard}>…</Field>
  <PrimaryButton type="submit" disabled={mutation.isPending}>…</PrimaryButton>
</form>
```

**Success and failure are both toasts.** The form only says which fields are wrong:

- **Success:** toast it in `onSuccess` and close the modal. `result.message` is the service's own wording ("LOG-0042 saved. Flagged for review.").
- **Failure:** nothing to write — `useActionMutation` toasts `errorTitle` with the service's message. The modal stays open with what the user typed.
- **Fields:** `fieldErrors(mutation.error)` gives `{ fieldName: message }`; pass each to its `<Field error=…>` so the user can see what to fix.
- **A failed query inside a form** (a select that couldn't load its options) still shows a `<FormError>` in the modal, since that isn't a failed save and there's nothing to toast.

Use `onSubmit`, not `<form action={…}>`. React resets a form after an `action` runs, which would wipe what the user typed whenever validation fails.

Put the form in an inner component that mounts only while the modal is open (see `equipmentTypeModal.tsx`), so each opening starts without the previous error.

---

## 6. Loading, empty and error states

Each card handles its own states, so one failed query doesn't blank the page. `DataCard`'s `emptyState` prop renders instead of the card body when set:

```tsx
const query = useQuery(equipmentTypesQuery());
const rows = query.data ?? [];

const placeholder = query.isPending ? (
  <DataCardBodySkeleton rows={6} columns={6} label="Loading equipment types…" />
) : query.isError ? (
  <ErrorState what="equipment types" message={query.error.message} onRetry={() => query.refetch()} retrying={query.isFetching} />
) : (
  rows.length === 0 && <EmptyState icon={Construction} title="No equipment types yet" description="…" action={<AddEquipmentTypeButton />} />
);

<DataCard title="…" flush action={query.isSuccess && …} emptyState={placeholder}>
  {/* table / list — only rendered when placeholder is falsy */}
</DataCard>
```

| State | Component (`src/components/ui/`) | When |
| --- | --- | --- |
| Route loading | `loading.tsx` using `skeleton.tsx` | Navigating to a page, while the server prefetches |
| Query loading | `DataCardBodySkeleton` | Only if the query wasn't prefetched |
| Failed | `ErrorState` | `query.isError`; offers **Try again** |
| Empty | `EmptyState` | Loaded with no rows; offer the "create first" action when there is one |
| Refreshing | nothing | `query.isFetching` with data already shown: keep showing it |

Hide header actions (`action={query.isSuccess && …}`) until the data they act on has loaded.

---

## 7. Query keys and caching

- **All keys live in `src/queries/keys.ts`.** Never write a key inline.
- **Keys are hierarchical:** `["standards", "equipment-types"]` sits under `["standards"]`, so invalidating `queryKeys.standards.all` refreshes both standards queries.
- **Parameters go last,** as an object: `queryKeys.fuelEntries.list({ status: "flagged" })` → `["fuel-entries", "list", { status: "flagged" }]`. Each filter gets its own cache entry, and invalidating `["fuel-entries"]` still refreshes them all.
- **Defaults** (`queryClient.ts`):
  - `staleTime` is **25 minutes**: opening a page again inside that window shows the cached copy with no request.
  - `gcTime` is 30 minutes, so unused data isn't dropped before it goes stale (TanStack's default is 5 minutes, which would quietly undo the long `staleTime`).
  - Refetches on window focus once stale (TanStack's default).
  - Retries network and 5xx errors twice; never retries 4xx (signed out, forbidden, not found).
- **Per query:** the sidebar's unread alert count uses 30 s, since it's the "something needs attention" signal. Lower `staleTime`, or add `refetchInterval`, for anything else that should track other people's work closely.
- **Page segments** (`next.config.ts`): `experimental.staleTimes.dynamic` is 30 s. Portal pages are dynamic, and Next caches those for 0 s by default, so every navigation re-ran the page on the server and re-queried the database.

### What a long `staleTime` does and doesn't delay

- **Your own writes are never delayed:** every mutation invalidates the queries it affects, which refetches regardless of freshness (§5.2).
- **Other people's changes** appear when a query refetches: on mount while stale, on window focus while stale, on reconnect, on invalidation, or via an `ErrorState`'s **Try again**. With the 25-minute default, another user's change can take that long to show.

---

## 8. Adding a page: checklist

1. **Keys:** add them to `src/queries/keys.ts`.
2. **Routes:** one `GET` per read under `src/app/api/<resource>/route.ts`, using `withActor` (with `{ admin: true }` for admin pages).
3. **Queries:** `src/queries/<area>Queries.ts` with `queryOptions`, typed with the service's return type.
4. **Actions:** `actions.ts` next to the page. Take `FormData`, return `ActionState`, no `revalidatePath`.
5. **Mutations:** `src/queries/<area>Mutations.ts`, listing every key each write affects.
6. **Client components:** move the page's lists and cards into `"use client"` components that call `useQuery`, with skeleton, error and empty states (§6).
7. **Page:** keep it a server component. Prefetch every query with the service call (§4), then wrap the client components in `HydrationBoundary`.
8. **Modals:** switch forms to `onSubmit` + the mutation hook (§5.3); toast and close on success.
9. **Clean up:** drop any placeholder data and the UI-only types that described it.
10. **Check:** `npx tsc --noEmit` and `yarn build`. A signed-out `curl /api/<resource>` should return a JSON `401`. In the browser, open React Query Devtools (bottom-left, development only) and confirm the page loads without an extra request and that saving refetches the right queries.

---

## 9. Rollout plan

| Part | Scope | Status |
| --- | --- | --- |
| 1 | Foundation (provider, client, `apiFetch`, keys, `withActor`, `useActionMutation`, `ErrorState`, `DataCardBodySkeleton`) + **Consumption Standards** | Done |
| 2 | **Equipment & Vehicles** (registry, stats, Add Equipment, edit, move to site, mark active/maintenance/idle, retire/reactivate) and **Users & Roles** (accounts, stats, Create User with optional temporary password, edit details, change role & site, set password, disable/enable) | Done |
| 3 | **Tankers** (tank cards, this month's reconciliation with loss total, intake log, Add Tanker, edit, archive, Record Intake with supplier suggestions, record dip, dip history) | Done |
| 4 | **Fuel Entry** (summary tiles, filter tabs, New Fuel Entry with Save & Add Another, request correction, and an administrator's Pending corrections card with approve/reject) | Done |
| 5 | **Theft Alerts** (counts, queue with state tabs, read/unread, mark all read, start review, resolve, reopen; the sidebar badge now reads `alert_reads`, and `alertReadStore.ts` is gone) and **Monthly Summary** (month picker, totals, rows, close/reopen, CSV export of all or selected rows) | Done |
| 6 | **Dashboard** (`DashboardService.getOverview` in one request), and `src/utils/sampleData.tsx` deleted — the marketing and demo-login copy moved to `src/utils/marketingContent.ts` | Done |

Every portal page now reads from the services. The remaining hard-coded content is the public marketing copy in `src/utils/marketingContent.ts`.

**Added after the rollout:** **void** on deliveries and fuel entries — an administrator can correct one that was mistyped (⋯ → Edit) or void one recorded in error (⋯ → Void, with a reason). A void row stays in its list, marked void, but drops out of tank levels, the reconciliation, fuel costs, the entry tiles, the monthly summary and the dashboard; restoring puts it back. Nothing is ever deleted, so past figures are never rewritten silently. Also two Set-up pages the guide left open — **Sites** (`/portal/sites`: add, edit, archive, with the equipment and tanker counts that block archiving) and **Drivers & Operators** (`/portal/operators`: add, edit, link a portal account, deactivate and reactivate). Both are administrator-only, listed in `ADMIN_PATHS` and in the sidebar's Set-up section.
