import { auth } from "@/lib/auth/server";

// Protects every page except auth views, API routes and static assets.
export default auth.middleware({ loginUrl: "/auth/sign-in" });

export const config = {
  matcher: ["/((?!api|auth|_next/static|_next/image|favicon.ico|manifest.json|icon.svg|icons).*)"],
};
