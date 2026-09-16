"use client";

import { useQuery } from "@tanstack/react-query";
import { Archive, MapPin, Pencil, RotateCcw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import ConfirmDialog from "@/components/modals/confirmDialog";
import SiteFormModal from "@/components/modals/siteFormModal";
import { AddSiteButton } from "@/components/setup/setupTriggers";
import DataCard from "@/components/ui/dataCard";
import EmptyState from "@/components/ui/emptyState";
import ErrorState from "@/components/ui/errorState";
import { MobileField, MobileFields, MobileList, MobileRecordHeader } from "@/components/ui/mobileList";
import RowActions from "@/components/ui/rowActions";
import { DataCardBodySkeleton } from "@/components/ui/skeleton";
import { useArchiveSite } from "@/queries/setupMutations";
import { sitesUsageQuery } from "@/queries/setupQueries";
import type { SiteUsageRow } from "@/types/site";

function SiteRowActions({ site }: { site: SiteUsageRow }) {
  const [dialog, setDialog] = useState<"edit" | "archive" | null>(null);
  const archive = useArchiveSite();
  const close = () => {
    setDialog(null);
    archive.reset();
  };
  const inUse = site.equipmentCount + site.tankCount > 0;

  return (
    <>
      <RowActions
        label={`${site.name} (${site.code})`}
        items={[
          { label: "Edit", icon: Pencil, onSelect: () => setDialog("edit") },
          { label: "Archive", icon: Archive, onSelect: () => setDialog("archive"), hidden: site.archivedAt !== null, tone: "danger", separated: true },
        ]}
      />
      <SiteFormModal open={dialog === "edit"} onClose={close} site={site} />
      <ConfirmDialog
        open={dialog === "archive"}
        onClose={close}
        onConfirm={() =>
          archive.mutate(
            { id: site.id },
            {
              onSuccess: (result) => {
                toast.success(`${site.name} archived`, { description: result.message });
                setDialog(null);
              },
            }
          )
        }
        title={`Archive ${site.name}?`}
        description={site.code}
        confirmLabel="Archive site"
        pendingLabel="Archiving…"
        pending={archive.isPending}
      >
        <p className="rounded-xl bg-slate-50 p-3.5 text-sm text-slate-600">
          {inUse
            ? `${site.equipmentCount} unit${site.equipmentCount === 1 ? "" : "s"} and ${site.tankCount} tanker${site.tankCount === 1 ? "" : "s"} are still based here. Move them to another site first.`
            : "It stops appearing in site pickers. Fuel entries and other records keep the site they were recorded at."}
        </p>
      </ConfirmDialog>
    </>
  );
}

export default function SitesCard() {
  const query = useQuery(sitesUsageQuery());
  const sites = query.data ?? [];

  const placeholder = query.isPending ? (
    <DataCardBodySkeleton rows={4} columns={5} label="Loading sites…" />
  ) : query.isError ? (
    <ErrorState what="sites" message={query.error.message} onRetry={() => query.refetch()} retrying={query.isFetching} />
  ) : (
    sites.length === 0 && (
      <EmptyState
        icon={MapPin}
        title="No sites yet"
        description="Add the places work happens. Equipment, tankers and records takers are all assigned to a site."
        action={<AddSiteButton />}
      />
    )
  );

  return (
    <DataCard
      title="Sites"
      description="Sites are archived, never deleted, so past records keep the site they were recorded at."
      flush
      emptyState={placeholder}
    >
      <MobileList>
        {sites.map((site) => (
          <li key={site.id} className={`px-5 py-4 sm:px-6 ${site.archivedAt ? "opacity-70" : ""}`}>
            <MobileRecordHeader
              title={<><span className="font-mono">{site.code}</span> · {site.name}</>}
              subtitle={site.region ?? "No region"}
              trailing={
                <>
                  {site.archivedAt && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                      <RotateCcw className="h-3 w-3" aria-hidden />
                      Archived
                    </span>
                  )}
                  <SiteRowActions site={site} />
                </>
              }
            />
            <MobileFields>
              <MobileField label="Equipment"><span className="tabular-nums">{site.equipmentCount}</span></MobileField>
              <MobileField label="Tankers"><span className="tabular-nums">{site.tankCount}</span></MobileField>
            </MobileFields>
          </li>
        ))}
      </MobileList>
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-150 border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 text-[11px] uppercase tracking-wider text-slate-400">
              <th scope="col" className="px-5 py-2.5 text-left font-semibold sm:px-6">Code</th>
              <th scope="col" className="px-3 py-2.5 text-left font-semibold">Site</th>
              <th scope="col" className="px-3 py-2.5 text-left font-semibold">Region</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">Equipment</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">Tankers</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">Status</th>
              <th scope="col" className="px-5 py-2.5 text-right font-semibold sm:px-6">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sites.map((site) => (
              <tr key={site.id} className={`transition-colors hover:bg-slate-50/70 ${site.archivedAt ? "text-slate-400" : ""}`}>
                <td className="px-5 py-3.5 font-mono text-sm font-semibold text-slate-900 sm:px-6">{site.code}</td>
                <td className="px-3 py-3.5 text-slate-700">{site.name}</td>
                <td className="px-3 py-3.5 text-slate-500">{site.region ?? "—"}</td>
                <td className="px-3 py-3.5 text-right tabular-nums text-slate-700">{site.equipmentCount}</td>
                <td className="px-3 py-3.5 text-right tabular-nums text-slate-700">{site.tankCount}</td>
                <td className="px-3 py-3.5 text-right">
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${
                      site.archivedAt ? "border-slate-200 bg-slate-50 text-slate-500" : "border-emerald-200 bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {site.archivedAt ? "Archived" : "Active"}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-right sm:px-6">
                  <SiteRowActions site={site} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DataCard>
  );
}
