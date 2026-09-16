"use client";

import {
  Fuel,
  LogOut,
  Menu,
  X,
  Gauge,
  FileText,
  ChartColumn,
  TriangleAlert,
  Truck,
  Target,
  Users,
  Container,
  HardHat,
  MapPin,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { logout } from "@/app/auth/actions";
import type { NavSection } from "@/types/navigation";
import type { AppUserRole } from "@/types/next-auth";
import { unreadAlertsQuery } from "@/queries/alertQueries";
import { roleLabels } from "@/utils/authRoutes";

type SidebarUser = { name: string; role: AppUserRole };

// *** Links for sidebar Based on Role
const adminNavLinks: NavSection[] = [
  {
    heading: "Administration",
    items: [
      { label: "Dashboard", href: "/portal/dashboard", icon: Gauge },
      { label: "Fuel Log Entry", href: "/portal/fuel_entry", icon: FileText },
      { label: "Tankers", href: "/portal/tankers", icon: Container },
      {
        label: "Monthly Summary",
        href: "/portal/monthly_summary",
        icon: ChartColumn,
      },
      {
        label: "Theft Alerts",
        href: "/portal/theft_alerts",
        icon: TriangleAlert,
      },
    ],
  },
  {
    heading: "Set-up",
    items: [
      {
        label: "Equipment & Vehicles",
        href: "/portal/equipment_and_vehicles",
        icon: Truck,
      },
      {
        label: "Consumption Standards",
        href: "/portal/consumption_standards",
        icon: Target,
      },
      { label: "Sites", href: "/portal/sites", icon: MapPin },
      { label: "Drivers & Operators", href: "/portal/operators", icon: HardHat },
      { label: "Users & Roles", href: "/portal/users_and_roles", icon: Users },
    ],
  },
];

const RecordsTakerNavLinks: NavSection[] = [
  {
    heading: "Recording",
    items: [
      { label: "Fuel Log Entry", href: "/portal/fuel_entry", icon: Fuel },
    ],
  },
];

const navLinksFor = (role: AppUserRole) =>
  role === "administrator" ? adminNavLinks : RecordsTakerNavLinks;

// ** Sidebar header component
function Brand() {
  return (
    <Link href="/portal" className="flex items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white">
        <Fuel className="h-5 w-5" strokeWidth={1.8} aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[15px] font-semibold leading-tight text-slate-900">
          FuelGuard
        </span>
        <span className="block truncate text-xs text-slate-500">
          Royal Dede Construction Ltd
        </span>
      </span>
    </Link>
  );
}

const THEFT_ALERTS_HREF = "/portal/theft_alerts";

/** Unresolved alerts this administrator hasn't opened yet. Only administrators can read alerts. */
function useUnreadAlertCount(role: AppUserRole) {
  const { data } = useQuery({ ...unreadAlertsQuery(), enabled: role === "administrator" });
  return data ?? 0;
}

// ** Unread theft alerts badge
function AlertBadge({ role }: { role: AppUserRole }) {
  const unread = useUnreadAlertCount(role);
  if (unread === 0) return null;

  return (
    <span
      className="ml-auto inline-flex items-center gap-1.5"
      aria-label={`${unread} unread alert${unread === 1 ? "" : "s"}`}
    >
      <span className="min-w-5 rounded-full bg-brand-600 px-1.5 py-0.5 text-center text-[11px] font-semibold leading-none tabular-nums text-white">
        {unread > 99 ? "99+" : unread}
      </span>
    </span>
  );
}

// ** Sidebar navigation links component
function NavLinks({ role, onNavigate }: { role: AppUserRole; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
      {navLinksFor(role).map((section) => (
        <div key={section.heading}>
          <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {section.heading}
          </p>
          <ul className="mt-2 space-y-0.5">
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={isActive ? "page" : undefined}
                    className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                      isActive
                        ? "bg-brand-50 font-medium text-brand-700"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <Icon
                      className={`h-4.5 w-4.5 shrink-0 ${
                        isActive
                          ? "text-brand-600"
                          : "text-slate-400 group-hover:text-slate-600"
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                    {item.href === THEFT_ALERTS_HREF && <AlertBadge role={role} />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

// ** Sidebar user card component
function UserCard({ user }: { user: SidebarUser }) {
  const initials = user.name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");

  return (
    <div className="border-t border-slate-200 p-3">
      <div className="flex items-center gap-3 rounded-lg px-2 py-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
          {initials}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-slate-900">
            {user.name}
          </span>
          <span className="block truncate text-xs text-slate-500">
            {roleLabels[user.role]}
          </span>
        </span>
        <form action={logout}>
          <button
            type="submit"
            aria-label="Sign out"
            title="Sign out"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <LogOut className="h-4.5 w-4.5" aria-hidden />
          </button>
        </form>
      </div>
    </div>
  );
}

// ** Main sidebar component
export default function Sidebar({ user }: { user: SidebarUser }) {
  const [isOpen, setIsOpen] = useState(false);
  const unreadCount = useUnreadAlertCount(user.role);
  const unreadAlerts = user.role === "administrator" ? unreadCount : 0;

  return (
    <>
      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-4 md:hidden">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Open navigation"
          className="relative rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          <Menu className="h-5 w-5" aria-hidden />
          {unreadAlerts > 0 && (
            <span aria-hidden className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-brand-600 ring-2 ring-white" />
          )}
        </button>
        <span className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500 text-white">
            <Fuel className="h-4 w-4" strokeWidth={1.8} aria-hidden />
          </span>
          <span className="text-sm font-semibold text-slate-900">FuelGuard</span>
        </span>
      </header>

      {/* Mobile drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setIsOpen(false)}
            className="absolute inset-0 bg-slate-900/40"
          />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
              <Brand />
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close navigation"
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <NavLinks role={user.role} onNavigate={() => setIsOpen(false)} />
            <UserCard user={user} />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="border-b border-slate-200 px-4 py-5">
          <Brand />
        </div>
        <NavLinks role={user.role} />
        <UserCard user={user} />
      </aside>
    </>
  );
}
