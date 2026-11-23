import { NextResponse, type NextRequest } from "next/server";

export default async function proxy(request: NextRequest) {
  // Without Auth0 configured (e.g., the public demo deployment), send visitors to the demo.
  if (!process.env.AUTH0_DOMAIN) {
    return NextResponse.redirect(new URL("/demo", request.url));
  }
  const { auth0 } = await import("./lib/auth0");
  return await auth0.middleware(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|demo).*)"],
};
