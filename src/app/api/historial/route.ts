import { NextRequest, NextResponse } from 'next/server'
// TODO: Cuando CU-03 esté completa, importar la conexión a Postgres
// import { db } from '@/lib/db'

export const runtime = 'nodejs'

/**
 * GET /api/historial
 * Obtiene el historial de consultas del usuario autenticado
 * 
 * TODO: Cuando CU-03 (Postgres) y CU-04 (NextAuth) estén completas:
 * 1. Obtener userId de la sesión de NextAuth
 * 2. Consultar la tabla queries desde Postgres
 * 3. Retornar los resultados ordenados por fecha
 */
export async function GET(req: NextRequest) {
  try {
    // TODO: Obtener userId de la sesión cuando NextAuth esté configurado
    // const session = await getServerSession(req)
    // if (!session?.user?.id) {
    //   return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    // }
    // const userId = session.user.id

    // TODO: Consultar desde Postgres cuando CU-03 esté completa
    // const queries = await db.query(`
    //   SELECT 
    //     id,
    //     query,
    //     legal_area,
    //     created_at,
    //     response_time,
    //     success
    //   FROM queries 
    //   WHERE user_id = $1 
    //   ORDER BY created_at DESC 
    //   LIMIT 50
    // `, [userId])

    // Por ahora, retornar array vacío o datos mock
    // Cuando CU-03 y CU-04 estén listas, simplemente descomentar el código arriba
    // y eliminar este return temporal
    return NextResponse.json([])
  } catch (error) {
    console.error('Error obteniendo historial:', error)
    return NextResponse.json(
      { error: 'Error al obtener historial', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
