import { Fuel } from "lucide-react";
import Link from "next/link";

import { footerColumns } from "@/utils/marketingContent";

export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-neutral-950">
      <div className="mx-auto w-full max-w-7xl px-6 py-16 lg:px-10">
        <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 lg:grid-cols-5">
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2.5">
              <Fuel className="h-7 w-7 text-brand-500" strokeWidth={1.8} aria-hidden />
              <span className="text-lg font-semibold tracking-tight text-white">
                Fuel<span className="text-brand-500">Guard</span>
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/50">
              A fuel tracking system for fleets — every fill recorded, measured
              against standard, and watched for the readings that don&apos;t add up.
            </p>
          </div>

          {footerColumns.map((column) => (
            <div key={column.heading}>
              <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-white/40">
                {column.heading}
              </h3>
              <ul className="mt-4 space-y-3">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-white/65 transition-colors hover:text-brand-400"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-white/10 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-white/40">
            &copy; {new Date().getFullYear()} Fuel Guard. All rights reserved.
          </p>
          <div className="flex items-center gap-6 text-sm text-white/40">
            <span className="inline-flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              All systems operational
            </span>
            <Link href="/auth/login" className="transition-colors hover:text-white">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
