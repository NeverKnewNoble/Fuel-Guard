"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import OperatorFormModal from "@/components/modals/operatorFormModal";
import SiteFormModal from "@/components/modals/siteFormModal";

const primary =
  "inline-flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:ring-offset-2 sm:w-auto";

export function AddSiteButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={primary}>
        <Plus className="h-4 w-4" aria-hidden />
        Add Site
      </button>
      <SiteFormModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function AddOperatorButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={primary}>
        <Plus className="h-4 w-4" aria-hidden />
        Add Operator
      </button>
      <OperatorFormModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
