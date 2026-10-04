"use client";

import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";

const control =
  "h-12 w-full rounded-xl bg-slate-100 px-4 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:bg-surface focus:ring-2 focus:ring-brand-500/50";

export function Field({
  label,
  htmlFor,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  hint?: string;
  /** A server validation message for this field; replaces the hint while shown. */
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="block text-xs font-medium uppercase tracking-wide text-slate-500"
      >
        {label}
        {required && <span className="ml-0.5 text-brand-600">*</span>}
      </label>
      <div className="mt-2">{children}</div>
      {error ? (
        <p id={`${htmlFor}-error`} className="mt-1.5 text-xs font-medium text-brand-700">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1.5 text-xs text-slate-400">{hint}</p>
      )}
    </div>
  );
}

/** Form-level error banner, e.g. a failed server action. */
export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3.5 py-2.5 text-sm text-brand-700"
    >
      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      {message}
    </p>
  );
}

export function TextInput({
  id,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { id: string }) {
  return <input id={id} className={control} {...props} />;
}

export function SelectInput({
  id,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { id: string }) {
  return (
    <select id={id} className={`${control} cursor-pointer`} {...props}>
      {children}
    </select>
  );
}

/** Read-only derived value, e.g. "Total KM" computed from start/end. */
export function DerivedValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-4 py-2.5">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-0.5 text-[15px] font-medium tabular-nums text-slate-900">
        {value}
      </p>
    </div>
  );
}

export function FieldRow({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>;
}

export function PrimaryButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 text-sm font-medium text-white transition-colors hover:bg-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-brand-500"
      {...props}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-surface px-5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:ring-offset-2"
      {...props}
    >
      {children}
    </button>
  );
}
