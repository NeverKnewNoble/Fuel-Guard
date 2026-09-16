"use client";

import { CircleCheck, CircleSlash, KeyRound, Pencil, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import ChangeRoleModal from "@/components/modals/changeRoleModal";
import ConfirmDialog from "@/components/modals/confirmDialog";
import EditUserModal from "@/components/modals/editUserModal";
import SetPasswordModal from "@/components/modals/setPasswordModal";
import RowActions from "@/components/ui/rowActions";
import { useSetUserStatus } from "@/queries/userMutations";
import type { AccountRow } from "@/types/account";

/** ⋯ menu on an account row. Your own account isn't listed, so every action here applies to someone else. */
export function UserRowActions({ account }: { account: AccountRow }) {
  const [dialog, setDialog] = useState<"edit" | "role" | "password" | "disable" | null>(null);
  const setStatus = useSetUserStatus();
  const close = () => {
    setDialog(null);
    setStatus.reset();
  };

  const disabled = account.status === "disabled";

  function enable() {
    setStatus.mutate(
      { id: account.id, status: "active" },
      { onSuccess: (result) => toast.success(`${account.name} enabled`, { description: result.message }) }
    );
  }

  return (
    <>
      <RowActions
        label={account.name}
        items={[
          { label: "Edit details", icon: Pencil, onSelect: () => setDialog("edit") },
          { label: "Change role", icon: ShieldCheck, onSelect: () => setDialog("role") },
          { label: "Set password", icon: KeyRound, onSelect: () => setDialog("password") },
          { label: "Disable", icon: CircleSlash, onSelect: () => setDialog("disable"), hidden: disabled, tone: "danger", separated: true },
          { label: "Enable", icon: CircleCheck, onSelect: enable, hidden: !disabled, separated: true },
        ]}
      />
      <EditUserModal open={dialog === "edit"} onClose={close} account={account} />
      <ChangeRoleModal open={dialog === "role"} onClose={close} account={account} />
      <SetPasswordModal open={dialog === "password"} onClose={close} account={account} />
      <ConfirmDialog
        open={dialog === "disable"}
        onClose={close}
        onConfirm={() =>
          setStatus.mutate(
            { id: account.id, status: "disabled" },
            {
              onSuccess: (result) => {
                toast.success(`${account.name} disabled`, { description: result.message });
                setDialog(null);
              },
            }
          )
        }
        title={`Disable ${account.name}?`}
        description={`${account.roleLabel} · ${account.email}`}
        confirmLabel="Disable account"
        pendingLabel="Disabling…"
        pending={setStatus.isPending}
      >
        <p className="rounded-xl bg-slate-50 p-3.5 text-sm text-slate-600">
          They won&apos;t be able to sign in. Accounts are never deleted, so the fuel entries and approvals they recorded stay
          attributed to them. You can enable the account again later.
        </p>
      </ConfirmDialog>
    </>
  );
}
