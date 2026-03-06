import NextAuth from 'next-auth'
import { authOptions } from '@/contexts/identity/infrastructure/AuthConfig'

export const runtime = 'nodejs'

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
