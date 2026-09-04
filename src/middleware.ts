import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const role = token?.role as string;
    const pathname = req.nextUrl.pathname;

    // Define role-based routing access rules
    const routeAccess: Record<string, string[]> = {
      "/analytics": ["owner"],
      "/dashboard": ["owner", "front_desk", "coach", "parent"],
      "/executive": ["owner"],
      "/registration": ["owner", "front_desk"],
      "/packages": ["owner", "front_desk"],
      "/attendance": ["owner", "front_desk", "coach"],
      "/progress": ["owner", "coach"],
      "/crm": ["owner", "front_desk"],
      "/zoho": ["owner"],
      "/admin/users": ["owner"],
      "/admin": ["owner"],
      "/students": ["owner", "front_desk", "coach"],
      "/package-register": ["owner", "front_desk"],
      "/attendance-register": ["owner", "front_desk", "parent"],
      "/payment-unbilled": ["owner", "front_desk"],
      "/coach-register": ["owner", "front_desk"],
      "/reports-centre": ["owner"],
      "/explorer": ["owner"],
      "/schedule": ["owner", "front_desk", "coach"],
      "/student-dashboard": ["owner", "front_desk", "coach", "parent"],
      "/progress-report": ["owner", "front_desk", "coach", "parent"],
      "/package-report": ["owner", "front_desk", "coach", "parent"],
      "/audit": ["owner"],
    };

    // Instant edge redirect for Root Page to correct dashboard
    if (pathname === "/") {
      if (role === 'owner') {
        return NextResponse.redirect(new URL("/analytics", req.url));
      } else if (role === 'front_desk') {
        return NextResponse.redirect(new URL("/action-centre", req.url));
      } else if (role === 'coach') {
        return NextResponse.redirect(new URL("/schedule", req.url));
      } else if (role === 'parent') {
        return NextResponse.redirect(new URL("/student-dashboard", req.url));
      }
    }

    // Find if the current pathname matches or starts with any restricted route
    for (const [route, allowedRoles] of Object.entries(routeAccess)) {
      if (pathname === route || pathname.startsWith(route + "/")) {
        if (!allowedRoles.includes(role)) {
          // If role is not allowed, redirect to / (which redirects to their correct landing page)
          return NextResponse.redirect(new URL("/", req.url));
        }
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    secret: process.env.NEXTAUTH_SECRET || "my-secret-key-12345",
  }
);

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (NextAuth API routes)
     * - login (login page)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api/auth|api/attendance-chart|login|_next/static|_next/image|favicon.ico).*)",
  ],
};
