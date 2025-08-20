import { NextRequest, NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { requestId, query, vote, notes } = body || {}
    if (!requestId || !vote || (vote !== 'up' && vote !== 'down')) {
      return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 })
    }
    const entry = {
      ts: new Date().toISOString(),
      requestId,
      query: query || null,
      vote,
      notes: notes || null,
      ip: req.headers.get('x-forwarded-for') || 'local'
    }
    const dir = path.join(process.cwd(), 'data')
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    const file = path.join(dir, 'feedback.log')
    fs.appendFileSync(file, JSON.stringify(entry) + '\n', 'utf-8')
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error interno' }, { status: 500 })
  }
} 