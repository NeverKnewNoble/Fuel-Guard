import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { features } from "@/utils/marketingContent";

export default function Features() {
  return (
    <section
      id="features"
      className="relative border-t border-white/5 bg-neutral-950 py-24 sm:py-32"
    >
      <div className="mx-auto w-full max-w-7xl px-6 lg:px-10">
        <div className="max-w-2xl">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-500">
            What&apos;s inside
          </span>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-5xl">
            From the pump to the monthly report
          </h2>
          <p className="mt-5 text-base leading-relaxed text-white/60 sm:text-lg">
            Fuel Guard covers the full chain of custody for fuel: capture it at the
            point of issue, measure it against the standard you set, and review what
            the numbers say — each step in its own part of the portal.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Link
                key={feature.title}
                href={feature.href}
                className={`group relative flex flex-col rounded-2xl border p-6 transition-colors ${
                  feature.accent
                    ? "border-brand-500/30 bg-brand-500/[0.07] hover:border-brand-500/60 hover:bg-brand-500/10"
                    : "border-white/10 bg-white/3 hover:border-white/25 hover:bg-white/6"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span
                    className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border ${
                      feature.accent
                        ? "border-brand-500/30 bg-brand-500/10 text-brand-400"
                        : "border-white/10 bg-white/5 text-white/80"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                      feature.role === "Admin"
                        ? "border-white/10 bg-white/5 text-white/50"
                        : "border-sky-400/25 bg-sky-400/10 text-sky-300"
                    }`}
                  >
                    {feature.role}
                  </span>
                </div>

                <h3 className="mt-5 text-lg font-semibold text-white">
                  {feature.title}
                </h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-white/55">
                  {feature.description}
                </p>

                <span
                  className={`mt-5 inline-flex items-center gap-1.5 text-sm font-medium ${
                    feature.accent ? "text-brand-400" : "text-white/70"
                  }`}
                >
                  Open
                  <ArrowRight
                    className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
