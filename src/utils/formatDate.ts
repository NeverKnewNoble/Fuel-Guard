/** Dates are shown in the business's time zone, whatever the viewer's device is set to. */
const TIME_ZONE = "Africa/Accra";

const dateTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const shortDateTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/** "15 Sep 2026, 14:05", or `fallback` when there's no date. */
export const formatDateTime = (date: Date | null | undefined, fallback = "—") => (date ? dateTime.format(date) : fallback);

/** "15 Sep, 14:05" — for compact cards where the year is obvious. */
export const formatShortDateTime = (date: Date | null | undefined, fallback = "—") =>
  date ? shortDateTime.format(date) : fallback;

/** Values for `<input type="date">` and `<input type="time">`, in Accra time: `{ date: "2026-09-15", time: "14:05" }`. */
export function dateTimeInputValues(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)!.value;
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}
