import type { LucideIcon } from "lucide-react";

export type FeatureRole = "Admin" | "Record taker";

export type Feature = {
  title: string;
  description: string;
  href: string;
  role: FeatureRole;
  icon: LucideIcon;
  accent?: boolean;
};
