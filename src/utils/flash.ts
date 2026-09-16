/**
 * One-shot toast messages that survive a server redirect. A server action sets
 * the cookie just before redirecting; <AppToaster> shows it on the next page
 * and deletes it. Shared by server and client code, so no server-only imports.
 */
export const FLASH_COOKIE = "fg_flash";

export type Flash = {
  type: "success" | "error" | "info";
  message: string;
  description?: string;
};

export function parseFlash(raw: string | undefined): Flash | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(decodeURIComponent(raw)) as Partial<Flash>;
    if (typeof value.message !== "string") return null;
    const type = value.type === "error" || value.type === "info" ? value.type : "success";
    return { type, message: value.message, description: value.description };
  } catch {
    return null;
  }
}
