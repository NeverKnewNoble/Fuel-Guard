"use client";

import { CircleAlert, LoaderCircle, RotateCw } from "lucide-react";

type ErrorStateProps = {
  /** What failed to load, e.g. "equipment types". */
  what: string;
  /** Usually `query.error.message`. */
  message?: string;
  /** Usually `() => query.refetch()`. */
  onRetry?: () => void;
  /** True while a retry is running. */
  retrying?: boolean;
  size?: "sm" | "md";
};

/** Shown in place of a list, table or chart whose data failed to load. */
export default function ErrorState({ what, message, onRetry, retrying = false, size = "md" }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center px-5 text-center sm:px-6 ${size === "sm" ? "py-8" : "py-12"}`}
    >
      <span
        className={`flex items-center justify-center rounded-xl bg-brand-50 text-brand-600 ${
          size === "sm" ? "h-10 w-10" : "h-12 w-12"
        }`}
      >
        <CircleAlert className={size === "sm" ? "h-5 w-5" : "h-6 w-6"} aria-hidden />
      </span>
      <p className="mt-3 text-sm font-semibold text-slate-900">Couldn&apos;t load {what}</p>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{message ?? "Something went wrong. Please try again."}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:ring-offset-2 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          {retrying ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <RotateCw className="h-4 w-4" aria-hidden />}
          {retrying ? "Retrying…" : "Try again"}
        </button>
      )}
    </div>
  );
}
