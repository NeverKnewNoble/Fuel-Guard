"use client";

import { useQuery } from "@tanstack/react-query";

import { Field, FieldRow, SelectInput } from "@/components/modals/fields";
import { sitesQuery } from "@/queries/siteQueries";
import type { AppUserRole } from "@/types/next-auth";
import { roleLabels } from "@/utils/authRoutes";

/**
 * Role + site selects shared by Create User and Change role. Records takers must have a site;
 * administrators may have "All sites" (posted as an empty `siteId`).
 */
export function RoleAndSiteFields({
  role,
  onRoleChange,
  defaultSiteId,
  errors,
  disabled,
  idPrefix,
}: {
  role: AppUserRole;
  onRoleChange: (role: AppUserRole) => void;
  defaultSiteId?: string | null;
  errors?: Record<string, string>;
  disabled?: boolean;
  idPrefix: string;
}) {
  const sites = useQuery(sitesQuery());
  const recordsTaker = role === "records_taker";

  return (
    <FieldRow>
      <Field label="Role" htmlFor={`${idPrefix}-role`} required error={errors?.role}>
        <SelectInput
          id={`${idPrefix}-role`}
          name="role"
          value={role}
          onChange={(e) => onRoleChange(e.target.value as AppUserRole)}
          disabled={disabled}
        >
          {(Object.keys(roleLabels) as AppUserRole[]).map((r) => (
            <option key={r} value={r}>
              {roleLabels[r]}
            </option>
          ))}
        </SelectInput>
      </Field>
      <Field
        label="Assigned site"
        htmlFor={`${idPrefix}-site`}
        required={recordsTaker}
        hint={sites.isError ? `Couldn't load sites: ${sites.error.message}` : recordsTaker ? "Entries are recorded against this site" : undefined}
        error={errors?.siteId}
      >
        {/* Keyed by role: switching to records taker clears "All sites", which they can't have. */}
        <SelectInput
          key={role}
          id={`${idPrefix}-site`}
          name="siteId"
          defaultValue={defaultSiteId ?? ""}
          required={recordsTaker}
          disabled={disabled || sites.isPending}
          aria-invalid={Boolean(errors?.siteId) || undefined}
        >
          {recordsTaker ? (
            <option value="" disabled>
              {sites.isPending ? "Loading sites…" : "Select site…"}
            </option>
          ) : (
            <option value="">All sites</option>
          )}
          {sites.data?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </SelectInput>
      </Field>
    </FieldRow>
  );
}
