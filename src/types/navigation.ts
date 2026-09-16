import type { LucideIcon } from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export type NavSection = {
  heading: string;
  items: NavItem[];
};

export type FooterLink = {
  label: string;
  href: string;
};

export type FooterColumn = {
  heading: string;
  links: FooterLink[];
};
