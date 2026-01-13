import { withAuth } from "next-auth/middleware"

export default withAuth({
    callbacks: {
        authorized({ req, token }) {
            const path = req.nextUrl.pathname;
            console.log(`[Middleware] Checking auth for: ${path}, Token exists: ${!!token}`);

            // Allow access to /api/webhook/* without login, block everything else (or specifically protect /dashboard)
            if (path.startsWith("/api/webhook")) {
                return true
            }
            if (path.startsWith("/auth")) {
                return true
            }
            // Require token for dashboard
            if (path.startsWith("/dashboard") || path.startsWith("/settings")) {
                const isAuthorized = !!token;
                console.log(`[Middleware] Dashboard access: ${isAuthorized ? 'GRANTED' : 'DENIED'}`);
                return isAuthorized;
            }
            return true
        },
    },
})

export const config = { matcher: ["/dashboard/:path*", "/settings/:path*", "/api/webhook/:path*"] }
