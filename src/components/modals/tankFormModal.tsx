"use client";

import { useQuery } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { Field, FieldRow, FormError, PrimaryButton, SecondaryButton, SelectInput, TextInput } from "@/components/modals/fields";
import Modal from "@/components/modals/modal";
import ErrorState from "@/components/ui/errorState";
import { Skeleton } from "@/components/ui/skeleton";
import { sitesQuery } from "@/queries/siteQueries";
import { useCreateTank, useUpdateTank } from "@/queries/tankMutations";
import { tankDetailQuery } from "@/queries/tankQueries";
import { fieldErrors } from "@/queries/useActionMutation";
import type { TankDetail, TankKind } from "@/types/tank";
import { tankKindLabels } from "@/utils/tankUtils";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Omit to add a tanker; pass an id to edit that tanker. */
  tankId?: string;
};

export default function TankFormModal({ open, onClose, tankId }: Props) {
  // Mount only while open, so each opening starts with fresh state.
  if (!open) return null;
  return tankId ? <EditLoader onClose={onClose} tankId={tankId} /> : <TankForm onClose={onClose} />;
}

function EditLoader({ onClose, tankId }: { onClose: () => void; tankId: string }) {
  const detail = useQuery(tankDetailQuery(tankId));
  if (detail.isSuccess) return <TankForm onClose={onClose} tank={detail.data} />;

  return (
    <Modal open onClose={onClose} title="Edit tanker">
      {detail.isError ? (
        <ErrorState size="sm" what="this tanker" message={detail.error.message} onRetry={() => detail.refetch()} retrying={detail.isFetching} />
      ) : (
        <div role="status" className="space-y-5 pb-4">
          <span className="sr-only">Loading tanker…</span>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i}>
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-2 h-12 w-full rounded-xl" />
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function TankForm({ onClose, tank }: { onClose: () => void; tank?: TankDetail }) {
  const editing = Boolean(tank);
  const formId = editing ? `edit-tank-${tank!.id}` : "add-tanker";
  const sites = useQuery(sitesQuery());

  const createTank = useCreateTank();
  const updateTank = useUpdateTank();
  const mutation = editing ? updateTank : createTank;
  const pending = mutation.isPending;
  const errors = fieldErrors(mutation.error);
  const noSites = sites.isSuccess && sites.data.length === 0;

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? `Edit ${tank!.code}` : "Add Tanker"}
      description={editing ? tank!.name : "Register a bulk tank or mobile bowser that holds fuel on site."}
      footer={
        <>
          <PrimaryButton type="submit" form={formId} disabled={pending || noSites || sites.isPending}>
            {pending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />}
            {pending ? "Saving…" : editing ? "Save changes" : "Add Tanker"}
          </PrimaryButton>
          <SecondaryButton type="button" onClick={onClose} disabled={pending}>
            Cancel
          </SecondaryButton>
        </>
      }
    >
      {noSites ? (
        <p className="mb-4 rounded-xl bg-amber-50 p-3.5 text-sm text-amber-800">
          No active site to keep the tanker at. Add one on{" "}
          <Link href="/portal/sites" className="font-medium underline" onClick={onClose}>
            Sites
          </Link>
          .
        </p>
      ) : (
        <form
          id={formId}
          className="space-y-4 pb-2"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate(new FormData(event.currentTarget), {
              onSuccess: (result) => {
                toast.success(editing ? `${tank!.code} updated` : "Tanker added", { description: result.message });
                onClose();
              },
            });
          }}
        >
          {sites.isError && <FormError message={`Couldn't load sites: ${sites.error.message}`} />}
          {editing && <input type="hidden" name="id" value={tank!.id} />}

          <FieldRow>
            <Field label="Tanker ID" htmlFor="tk-code" hint={editing ? undefined : "Leave empty to number it automatically"} error={errors?.code}>
              <TextInput id="tk-code" name="code" placeholder="TNK-08" defaultValue={tank?.code} required={editing} maxLength={30} disabled={pending} />
            </Field>
            <Field label="Name" htmlFor="tk-name" required error={errors?.name}>
              <TextInput id="tk-name" name="name" placeholder="Bulk Tanker C" defaultValue={tank?.name} required maxLength={80} disabled={pending} />
            </Field>
          </FieldRow>

          <FieldRow>
            <Field label="Type" htmlFor="tk-kind" required error={errors?.kind}>
              <SelectInput id="tk-kind" name="kind" defaultValue={tank?.kind ?? "bulk"} required disabled={pending}>
                {(Object.keys(tankKindLabels) as TankKind[]).map((kind) => (
                  <option key={kind} value={kind}>
                    {tankKindLabels[kind]}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Site" htmlFor="tk-site" required error={errors?.siteId}>
              <SelectInput id="tk-site" name="siteId" defaultValue={tank?.siteId ?? ""} required disabled={pending || sites.isPending}>
                <option value="" disabled>
                  {sites.isPending ? "Loading sites…" : "Select site…"}
                </option>
                {sites.data?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </SelectInput>
            </Field>
          </FieldRow>

          <FieldRow>
            <Field
              label="Capacity (L)"
              htmlFor="tk-cap"
              required
              hint={editing ? "Can't go below the current level" : undefined}
              error={errors?.capacityL}
            >
              <TextInput
                id="tk-cap"
                name="capacityL"
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                placeholder="10000"
                defaultValue={tank?.capacityL}
                required
                disabled={pending}
              />
            </Field>
            {!editing && (
              <Field label="Opening level (L)" htmlFor="tk-open" hint="Measured dip now. Recorded as its first dip." error={errors?.openingL}>
                <TextInput id="tk-open" name="openingL" type="number" inputMode="decimal" min="0" step="0.01" placeholder="0" disabled={pending} />
              </Field>
            )}
          </FieldRow>
        </form>
      )}
    </Modal>
  );
}
