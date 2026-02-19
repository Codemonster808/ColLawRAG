import '../styles/globals.css'
import type { Metadata } from 'next'
import SessionProvider from '@/components/SessionProvider'

export const metadata: Metadata = {
  title: 'RAG Derecho Colombiano',
  description: 'Consulta leyes colombianas con RAG en español, con citas.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  )
} 