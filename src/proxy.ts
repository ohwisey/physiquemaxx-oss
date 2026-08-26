import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Auth gate (Next 16 proxy — the renamed middleware convention).
 * Unauthenticated visitors → /login; authenticated /login visits → /.
 * Also refreshes the Supabase session cookies on every matched request.
 */
export async function proxy(request: NextRequest) {
  // Demo mode runs entirely on seeded fixtures — no auth, no Supabase.
  if (process.env.NEXT_PUBLIC_DEMO === "1") {
    return NextResponse.next({ request });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Validates the token with Supabase Auth — do not trust the raw cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const onLogin = request.nextUrl.pathname.startsWith("/login");

  if (!user && !onLogin) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/login";
    redirect.search = "";
    return NextResponse.redirect(redirect);
  }

  if (user && onLogin) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/";
    redirect.search = "";
    const home = NextResponse.redirect(redirect);
    // Keep any refreshed auth cookies on the redirect.
    for (const cookie of response.cookies.getAll()) {
      home.cookies.set(cookie);
    }
    return home;
  }

  return response;
}

export const config = {
  // Everything except the analyze API route, Next internals, and static
  // assets (anything with a file extension, e.g. /seed/*.jpg).
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
