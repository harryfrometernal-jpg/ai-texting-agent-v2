import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"


export const authOptions = {
    providers: [
        CredentialsProvider({
            name: 'Credentials',
            credentials: {
                email: { label: "Email", type: "text" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials) {
                console.log('[Auth] Authorize called with:', { email: credentials?.email });
                if (!credentials?.email || !credentials?.password) {
                    console.log('[Auth] Missing credentials');
                    return null;
                }

                const adminEmail = process.env.ADMIN_EMAIL || "harrycastaner@gmail.com";
                const adminPassword = process.env.ADMIN_PASSWORD || "password123";

                console.log(`[Auth] Attempting login: ${credentials.email} vs Expected: ${adminEmail} (Env check - Email: ${!!process.env.ADMIN_EMAIL}, Pwd: ${!!process.env.ADMIN_PASSWORD})`);

                // Mask password for logs
                const passMatch = credentials.password === adminPassword;
                console.log(`[Auth] Password check: ${passMatch ? 'MATCH' : 'MISMATCH'}`);

                if (credentials.email === adminEmail && passMatch) {
                    console.log('[Auth] Credentials valid, returning user object');
                    return { id: "1", name: "Harry Castaner", email: adminEmail }
                }

                console.log('[Auth] Credentials invalid');
                return null
            }
        })
    ],
    pages: {
        signIn: '/auth/signin',
    },
    callbacks: {
        async session({ session, token }: any) {
            console.log('[Auth] Session callback', { user: session?.user?.email, token: !!token });
            return session
        },
        async jwt({ token, user }: any) {
            console.log('[Auth] JWT callback', { token: !!token, user: !!user });
            return token
        }
    },
    secret: process.env.NEXTAUTH_SECRET,
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
