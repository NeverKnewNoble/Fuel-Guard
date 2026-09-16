"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { toast, Toaster } from "sonner";

import { FLASH_COOKIE, parseFlash } from "@/utils/flash";

/** Global toast outlet. Also shows any flash message a server action left before redirecting. */
export default function AppToaster() {
  const pathname = usePathname();

  // Re-check on every navigation: server-action redirects are client-side transitions.
  useEffect(() => {
    const raw = document.cookie
      .split("; ")
      .find((part) => part.startsWith(`${FLASH_COOKIE}=`))
      ?.slice(FLASH_COOKIE.length + 1);

    const flash = parseFlash(raw);
    if (raw !== undefined) {
      // Delete before showing so a re-run (e.g. Strict Mode) can't toast twice.
      document.cookie = `${FLASH_COOKIE}=; Max-Age=0; path=/; SameSite=Lax`;
    }
    if (flash) {
      toast[flash.type](flash.message, { description: flash.description });
    }
  }, [pathname]);

  return <Toaster position="top-right" richColors closeButton />;
}
