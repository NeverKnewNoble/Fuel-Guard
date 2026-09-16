"use client";

import { CircleAlert, Fuel, LoaderCircle, Moon } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { login } from "@/app/auth/actions";
import type { DemoUser } from "@/types/user";
import { demoUsers } from "@/utils/marketingContent";

const inputClass =
  "mt-2 h-12 w-full rounded-xl bg-slate-100 px-4 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-brand-500/50 disabled:opacity-60";

export default function LoginForm({
  callbackUrl,
  initialError,
}: {
  callbackUrl?: string;
  /** Message for an error passed back in the URL, e.g. after a failed Auth.js redirect. */
  initialError?: string;
}) {
  const [state, formAction, pending] = useActionState(login, undefined);
  const [email, setEmail] = useState("");
  const [selectedDemo, setSelectedDemo] = useState<string | null>(null);

  const error = state?.error ?? initialError;

  // A new state object comes back on every failed attempt, so repeat failures toast again.
  useEffect(() => {
    if (state?.error) toast.error("Sign-in failed", { description: state.error, id: "login-error" });
  }, [state]);

  useEffect(() => {
    if (initialError) toast.error("Sign-in failed", { description: initialError, id: "login-error" });
  }, [initialError]);

  function selectDemoUser(user: DemoUser) {
    setSelectedDemo(user.role);
    setEmail(user.email);
  }

  return (
    <div className="relative flex min-h-screen flex-1 flex-col items-center justify-center bg-slate-50 px-4 py-12">
      <button
        type="button"
        aria-label="Switch to dark mode"
        className="absolute right-3 top-3 sm:right-5 sm:top-5 rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-200/70 hover:text-slate-600"
      >
        <Moon className="h-5 w-5" aria-hidden />
      </button>

      <div className="w-full max-w-107.5">
        {/* Brand */}
        <div className="flex items-center justify-center gap-3.5">
          <span className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-brand-500 text-white shadow-sm">
            <Fuel className="h-7 w-7" strokeWidth={1.8} aria-hidden />
          </span>
          <div>
            <h1 className="text-[26px] font-medium leading-tight tracking-tight text-slate-900">
              FuelGuard
            </h1>
            <p className="text-sm text-slate-500">
              Royal Dede Construction Limited
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="mt-8 rounded-2xl bg-white p-6 shadow-[0_4px_24px_rgba(15,23,42,0.06)] sm:p-8">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-slate-900">
              Sign in to your account
            </h2>
            <p className="mt-1.5 text-sm text-slate-500">
              Fuel tracking &amp; theft detection system
            </p>
          </div>

          <form action={formAction} className="mt-7">
            {callbackUrl && <input type="hidden" name="callbackUrl" value={callbackUrl} />}

            {error && (
              <p
                role="alert"
                className="mb-5 flex items-start gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3.5 py-2.5 text-sm text-brand-700"
              >
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                {error}
              </p>
            )}

            <label
              htmlFor="email"
              className="block text-xs font-medium uppercase tracking-wide text-slate-500"
            >
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@royaldede.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={pending}
              aria-invalid={Boolean(error) || undefined}
              className={inputClass}
            />

            <label
              htmlFor="password"
              className="mt-5 block text-xs font-medium uppercase tracking-wide text-slate-500"
            >
              Password
            </label>
            {/* Uncontrolled, so React clears it when a failed attempt resets the form. */}
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              disabled={pending}
              aria-invalid={Boolean(error) || undefined}
              className={inputClass}
            />

            <button
              type="submit"
              disabled={pending}
              className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 text-[15px] font-medium text-white transition-colors hover:bg-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-brand-500"
            >
              {pending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />}
              {pending ? "Signing in…" : "Sign in"}
            </button>
          </form>

          {/* Demo quick access */}
          <div className="mt-7 border-t border-slate-200 pt-5">
            <p className="text-center text-[11px] font-medium uppercase tracking-wider text-slate-400">
              Demo &mdash; Quick access
            </p>
            <div className="mt-3.5 grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
              {demoUsers.map((user) => {
                const isSelected = selectedDemo === user.role;
                return (
                  <button
                    key={user.role}
                    type="button"
                    onClick={() => selectDemoUser(user)}
                    disabled={pending}
                    className={`rounded-xl border px-3.5 py-2.5 text-left transition-colors ${
                      isSelected
                        ? "border-brand-500 bg-brand-50/60"
                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <span className="block text-[13px] text-slate-500">
                      {user.role}
                    </span>
                    <span
                      className={`block text-[15px] ${
                        isSelected ? "text-brand-600" : "text-slate-900"
                      }`}
                    >
                      {user.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
