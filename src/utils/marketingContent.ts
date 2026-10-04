import {
  ChartColumn,
  Clock,
  FileText,
  Fuel,
  Gauge,
  Target,
  TriangleAlert,
  Truck,
  Users,
} from "lucide-react";

import type { Feature } from "@/types/feature";
import type { FooterColumn } from "@/types/navigation";
import type { HeroStat } from "@/types/stat";
import type { DemoUser } from "@/types/user";

/**
 * Copy for the public marketing pages, plus the two demo accounts offered as quick
 * access on the login form (they still have to sign in with a real password).
 * The portal's own data comes from the services — see docs/data-fetching.md.
 */

/* ---------------------------------- Home ---------------------------------- */

export const heroStats: HeroStat[] = [
  { value: "Real-time", label: "Fuel log capture" },
  { value: "Rule-based", label: "Theft detection" },
  { value: "Role-based", label: "Portal access" },
  { value: "Daily + Monthly", label: "Reporting" },
];

export const features: Feature[] = [
  {
    title: "Theft alerts",
    description:
      "Flags fills that break your rules — impossible refill volumes, repeat top-ups and consumption that runs past standard.",
    href: "/portal/theft_alerts",
    role: "Admin",
    icon: TriangleAlert,
    accent: true,
  },
  {
    title: "Dashboard",
    description:
      "One live view of fuel spend, volume drawn and open alerts across the whole fleet.",
    href: "/portal/dashboard",
    role: "Admin",
    icon: Gauge,
  },
  {
    title: "Daily fuel log",
    description:
      "Every issue of fuel for the day in one register — vehicle, driver, litres, odometer and who recorded it.",
    href: "/portal/daily_fuel_log",
    role: "Admin",
    icon: FileText,
  },
  {
    title: "Monthly summary",
    description:
      "Roll the daily register up into per-vehicle and fleet-wide totals for month-end reporting.",
    href: "/portal/monthly_summary",
    role: "Admin",
    icon: ChartColumn,
  },
  {
    title: "Equipment & vehicles",
    description:
      "Keep the register of every truck, generator and machine that draws fuel, with its tank and meter details.",
    href: "/portal/equipment_and_vehicles",
    role: "Admin",
    icon: Truck,
  },
  {
    title: "Consumption standards",
    description:
      "Set the expected litres per km or per hour for each asset — the benchmark every entry is measured against.",
    href: "/portal/consumption_standards",
    role: "Admin",
    icon: Target,
  },
  {
    title: "Users & roles",
    description:
      "Decide who records fuel and who reviews it, with separate portals for administrators and record takers.",
    href: "/portal/users_and_roles",
    role: "Admin",
    icon: Users,
  },
  {
    title: "Fuel log entry",
    description:
      "A fast form built for the pump — capture the fill in seconds, right where it happens.",
    href: "/portal/fuel_log_entry",
    role: "Record taker",
    icon: Fuel,
  },
  {
    title: "Recent entries",
    description:
      "Review and correct the fills you just captured, before they close off for the day.",
    href: "/portal/recent_entries",
    role: "Record taker",
    icon: Clock,
  },
];

export const footerColumns: FooterColumn[] = [
  {
    heading: "Administration",
    links: [
      { label: "Dashboard", href: "/portal/dashboard" },
      { label: "Daily fuel log", href: "/portal/daily_fuel_log" },
      { label: "Monthly summary", href: "/portal/monthly_summary" },
      { label: "Theft alerts", href: "/portal/theft_alerts" },
    ],
  },
  {
    heading: "Set-up",
    links: [
      { label: "Equipment & vehicles", href: "/portal/equipment_and_vehicles" },
      { label: "Consumption standards", href: "/portal/consumption_standards" },
      { label: "Users & roles", href: "/portal/users_and_roles" },
    ],
  },
  {
    heading: "Recording",
    links: [
      { label: "Fuel log entry", href: "/portal/fuel_log_entry" },
      { label: "Recent entries", href: "/portal/recent_entries" },
      { label: "Sign in", href: "/auth/login" },
    ],
  },
];

/* ---------------------------------- Auth ---------------------------------- */

export const demoUsers: DemoUser[] = [
  {
    role: "Administrator",
    name: "Kwabena Adjei",
    email: "kwabena.adjei@example.com",
  },
  {
    role: "Records Taker",
    name: "Kwame Asante",
    email: "kwame.asante@example.com",
  },
];
