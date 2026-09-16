import { ArrowRight, Fuel } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { heroStats } from "@/utils/marketingContent";

export default function Hero() {
  return (
    <section className="relative isolate flex min-h-screen flex-col overflow-hidden bg-neutral-950">
      <Image
        src="/hero/1.jpg"
        alt=""
        fill
        preload
        sizes="100vw"
        className="object-cover object-center"
      />

      {/* Scrims: keep the photo readable behind text on every breakpoint */}
      <div className="absolute inset-0 bg-linear-to-r from-neutral-950 via-neutral-950/85 to-neutral-950/20" />
      <div className="absolute inset-0 bg-linear-to-t from-neutral-950 via-neutral-950/25 to-neutral-950/70" />
      <div className="absolute -left-40 top-1/4 h-128 w-lg rounded-full bg-brand-600/15 blur-3xl" />

      {/* Header */}
      <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between gap-6 px-6 py-6 lg:px-10">
        <Link href="/" className="flex items-center gap-2.5">
          <Fuel className="h-7 w-7 text-brand-500" strokeWidth={1.8} aria-hidden />
          <span className="text-lg font-semibold tracking-tight text-white">
            Fuel<span className="text-brand-500">Guard</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm text-white/70 md:flex">
          {/* <a className="transition-colors hover:text-white" href="#features">
            Features
          </a> */}
          {/* <Link className="transition-colors hover:text-white" href="/portal/dashboard">
            Dashboard
          </Link>
          <Link className="transition-colors hover:text-white" href="/portal/theft_alerts">
            Theft alerts
          </Link> */}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/auth/login"
            className="whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white sm:px-4"
          >
            Login
          </Link>
          <Link
            href="/portal/dashboard"
            className="whitespace-nowrap rounded-full bg-white px-3.5 py-2 text-sm font-semibold text-neutral-950 transition-colors hover:bg-brand-100 sm:px-4"
          >
            Open portal
          </Link>
        </div>
      </header>

      {/* Hero copy */}
      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 items-center px-6 py-16 lg:px-10">
        <div className="max-w-2xl">
          {/* <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-white/80 backdrop-blur-sm">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-500 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-500" />
            </span>
            Fuel tracking &amp; theft monitoring
          </span> */}

          <h1 className="mt-6 text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-7xl">
            Every litre,
            <br />
            <span className="bg-linear-to-r from-brand-300 via-brand-400 to-brand-600 bg-clip-text text-transparent">
              accounted for.
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-base leading-relaxed text-white/70 sm:text-lg">
            Fuel Guard tracks every fill across your vehicles and equipment, measures
            it against your own consumption standards, and flags the readings that
            don&apos;t add up — before the fuel is gone.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/portal/dashboard"
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-brand-600 px-7 text-sm font-semibold text-white transition-colors hover:bg-brand-500"
            >
              Open the portal
              <ArrowRight
                className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
            <Link
              href="/portal/fuel_log_entry"
              className="inline-flex h-12 items-center justify-center rounded-full border border-white/20 bg-white/5 px-7 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:border-white/40 hover:bg-white/10"
            >
              Record a fuel entry
            </Link>
          </div>
        </div>
      </div>

      {/* Stat strip */}
      <div className="relative z-10 border-t border-white/10 bg-neutral-950/40 backdrop-blur-sm">
        <dl className="mx-auto grid w-full max-w-7xl grid-cols-2 gap-px px-6 py-8 lg:grid-cols-4 lg:px-10">
          {heroStats.map((stat) => (
            <div key={stat.label} className="px-1 py-2 lg:px-4">
              <dt className="text-base font-semibold text-white sm:text-lg">
                {stat.value}
              </dt>
              <dd className="mt-1 text-xs uppercase tracking-wider text-white/50">
                {stat.label}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
