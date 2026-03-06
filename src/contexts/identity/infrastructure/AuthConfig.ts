/**
 * NextAuth.js Configuration (CU-04)
 * Providers: Google OAuth, Credentials (email/password con usuario demo o DB).
 */

import type { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'

export const authOptions: NextAuthOptions = {
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
    CredentialsProvider({
      id: 'credentials',
      name: 'Email y contraseña',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        // Usuario demo desde env (opcional). Para producción conectar con Postgres + bcrypt.
        const demoEmail = process.env.DEMO_LOGIN_EMAIL
        const demoPassword = process.env.DEMO_LOGIN_PASSWORD
        if (demoEmail && demoPassword && credentials.email === demoEmail && credentials.password === demoPassword) {
          return { id: 'demo-user', email: demoEmail, name: 'Usuario demo' }
        }
        // TODO: Cuando haya tabla users con password_hash en Postgres:
        // const user = await pgGetUserByEmail(credentials.email)
        // if (user && await bcrypt.compare(credentials.password, user.password_hash)) return { id: user.id, email: user.email, name: user.name }
        return null
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.sub = user.id
      if (user?.email) token.email = user.email
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? ''
      }
      return session
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith('/')) return `${baseUrl}${url}`
      if (new URL(url).origin === baseUrl) return url
      return baseUrl + '/app'
    },
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 días
  },

  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
}
