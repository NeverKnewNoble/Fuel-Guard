export type PeriodStatus = "open" | "closed";

export type ReportingPeriod = {
  id: string;
  /** Always the 1st of the month, 'YYYY-MM-01'. */
  month: string;
  status: PeriodStatus;
};

export type ReportingPeriodListItem = ReportingPeriod & {
  /** "September 2024". */
  label: string;
  closedAt: Date | null;
  closedByName: string | null;
};
