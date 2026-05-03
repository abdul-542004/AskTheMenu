import { type NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { guestRegex, isDevelopmentEnvironment } from "@/lib/constants";
import { hasDatabaseUrl } from "@/lib/db/url";

const hasDatabase = hasDatabaseUrl();

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/ping")) {
    return new Response("pong", { status: 200 });
  }

  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  if (!hasDatabase || pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    secureCookie: !isDevelopmentEnvironment,
  });

  const isGuest = guestRegex.test(token?.email ?? "");

  if (token && !isGuest && ["/login", "/register"].includes(pathname)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (
    (pathname === "/" ||
      pathname.startsWith("/chat/") ||
      pathname.startsWith("/menu") ||
      pathname.startsWith("/kitchen")) &&
    !token
  ) {
    const redirectUrl = `${pathname}${request.nextUrl.search}`;
    const guestUrl = new URL("/api/auth/guest", request.url);
    guestUrl.searchParams.set("redirectUrl", redirectUrl);
    return NextResponse.redirect(guestUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/chat/:id",
    "/api/:path*",
    "/login",
    "/register",

    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
