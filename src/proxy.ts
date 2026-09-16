import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { homeFor, isAdminPath, LOGIN_PATH } from "@/utils/authRoutes";

/**
 * Optimistic redirects from the session cookie only — no database calls.
 * Layouts re-check the session, so this is a fast path, not the only guard.
 */
export default auth((req) => {
  const { pathname, search } = req.nextUrl;
  const user = req.auth?.user;

  if (pathname.startsWith("/portal")) {
    if (!user) {
      const url = new URL(LOGIN_PATH, req.nextUrl);
      url.searchParams.set("callbackUrl", `${pathname}${search}`);
      return NextResponse.redirect(url);
    }
    if (user.role !== "administrator" && isAdminPath(pathname)) {
      return NextResponse.redirect(new URL(homeFor(user.role), req.nextUrl));
    }
  }

  if (pathname === LOGIN_PATH && user) {
    return NextResponse.redirect(new URL(homeFor(user.role), req.nextUrl));
  }
});

export const config = {
  matcher: ["/portal/:path*", "/auth/login"],
};
