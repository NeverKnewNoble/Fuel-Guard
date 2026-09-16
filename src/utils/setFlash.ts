import { cookies } from "next/headers";

import { FLASH_COOKIE, type Flash } from "@/utils/flash";

/** Queue a toast for the next page. Call from a server action before `redirect()`. */
export async function setFlash(flash: Flash) {
  // Next URL-encodes cookie values itself; encoding here too would double-encode.
  (await cookies()).set(FLASH_COOKIE, JSON.stringify(flash), {
    path: "/",
    maxAge: 60,
    sameSite: "lax",
    // Read and cleared by the browser, so it can't be httpOnly. It only ever holds UI text.
    httpOnly: false,
  });
}
