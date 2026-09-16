"use client";

import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";

import { CreateUserButton } from "@/components/modals/triggers";
import DataCard from "@/components/ui/dataCard";
import EmptyState from "@/components/ui/emptyState";
import ErrorState from "@/components/ui/errorState";
import { MobileField, MobileFields, MobileList, MobileRecordHeader } from "@/components/ui/mobileList";
import {
  RowCheckbox,
  SelectAllBar,
  SelectAllCheckbox,
  SelectableRow,
  SelectionBar,
  SelectionProvider,
} from "@/components/ui/selection";
import { DataCardBodySkeleton } from "@/components/ui/skeleton";
import StatusPill from "@/components/ui/statusPill";
import { UserRowActions } from "@/components/users/userRowActions";
import { accountsQuery } from "@/queries/userQueries";
import type { AccountRow } from "@/types/account";
import { formatDateTime } from "@/utils/formatDate";
import { initialsOf } from "@/utils/fuelEntryUtils";
import { accountStatusStyles, roleStyles } from "@/utils/statusUtils";

function RolePill({ account }: { account: AccountRow }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${roleStyles[account.role]}`}>
      {account.roleLabel}
    </span>
  );
}

/** Your own account is left out: you manage it from your profile, and you can't disable or demote yourself here. */
export default function AccountsCard({ currentUserId }: { currentUserId: string }) {
  const query = useQuery(accountsQuery());
  const accounts = (query.data ?? []).filter((account) => account.id !== currentUserId);

  const placeholder = query.isPending ? (
    <DataCardBodySkeleton rows={6} columns={6} label="Loading accounts…" />
  ) : query.isError ? (
    <ErrorState what="accounts" message={query.error.message} onRetry={() => query.refetch()} retrying={query.isFetching} />
  ) : (
    accounts.length === 0 && (
      <EmptyState
        icon={Users}
        title="No other accounts yet"
        description="Yours is the only account. Create one for each administrator and records taker who needs to use the portal."
        action={<CreateUserButton />}
      />
    )
  );

  return (
    <SelectionProvider ids={accounts.map((u) => u.id)}>
    <DataCard
      title="Accounts"
      description="Everyone else with access to the portal. Your own account isn't listed."
      flush
      // Accounts are disabled, never deleted (records point at them), so there's no bulk Delete.
      action={query.isSuccess && <SelectionBar noun="account" actions={["export"]} />}
      emptyState={placeholder}
    >
      <SelectAllBar label="accounts" />
      <MobileList>
        {accounts.map((account) => (
          <SelectableRow key={account.id} id={account.id} as="li" className="px-5 py-4 sm:px-6">
            <MobileRecordHeader
              select={<RowCheckbox id={account.id} label={account.name} />}
              title={account.name}
              subtitle={account.email}
              trailing={<UserRowActions account={account} />}
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <RolePill account={account} />
              <StatusPill {...accountStatusStyles[account.status]} />
            </div>
            <MobileFields>
              <MobileField label="Site">{account.siteName}</MobileField>
              <MobileField label="Last active">
                <span className="font-mono text-xs tabular-nums">{formatDateTime(account.lastActiveAt, "Never")}</span>
              </MobileField>
            </MobileFields>
          </SelectableRow>
        ))}
      </MobileList>
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[960px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 text-[11px] uppercase tracking-wider text-slate-400">
              <th scope="col" className="w-10 px-5 py-2.5 text-left sm:px-6">
                <SelectAllCheckbox label="accounts" />
              </th>
              <th scope="col" className="px-3 py-2.5 text-left font-semibold">User</th>
              <th scope="col" className="px-3 py-2.5 text-left font-semibold">Role</th>
              <th scope="col" className="px-3 py-2.5 text-left font-semibold">Assigned site</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">Last active</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">Status</th>
              <th scope="col" className="px-5 py-2.5 text-right font-semibold sm:px-6">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {accounts.map((account) => (
              <SelectableRow key={account.id} id={account.id} className="transition-colors hover:bg-slate-50/70">
                <td className="px-5 py-3.5 sm:px-6">
                  <RowCheckbox id={account.id} label={account.name} />
                </td>
                <td className="px-3 py-3.5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600">
                      {initialsOf(account.name)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-slate-900">{account.name}</span>
                      <span className="block truncate text-sm text-slate-500">{account.email}</span>
                    </span>
                  </div>
                </td>
                <td className="px-3 py-3.5">
                  <RolePill account={account} />
                </td>
                <td className="px-3 py-3.5 text-slate-500">{account.siteName}</td>
                <td className="px-3 py-3.5 text-right font-mono text-xs tabular-nums text-slate-500">
                  {formatDateTime(account.lastActiveAt, "Never")}
                </td>
                <td className="px-3 py-3.5 text-right">
                  <StatusPill {...accountStatusStyles[account.status]} />
                </td>
                <td className="px-5 py-3.5 text-right sm:px-6">
                  <UserRowActions account={account} />
                </td>
              </SelectableRow>
            ))}
          </tbody>
        </table>
      </div>
    </DataCard>
    </SelectionProvider>
  );
}
