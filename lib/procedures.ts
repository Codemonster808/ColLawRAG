/**
 * Carga y formatea la base de procedimientos legales (data/procedures/)
 * para inyectar en el contexto RAG cuando la consulta sea procedural.
 */
import fs from 'node:fs'
import path from 'node:path'
import type { DocumentChunk } from './types'

const PROCEDURES_DIR = path.join(process.cwd(), 'data', 'procedures')

export interface ProcedureIndexEntry {
  id: string
  nombre: string
  tipo: string
  ambito?: string
  duracion_estimada?: string
  cuantia?: string
  file: string
  normas_principales?: string[]
}

export interface ProcedureStage {
  nombre: string
  orden: number
  plazos?: { dias?: number; descripcion?: string; hitos?: string[] }
  documentos?: string[]
  entidades?: Array<{ rol: string; descripcion: string }>
}

export interface ProcedureDetail {
  id: string
  nombre: string
  descripcion?: string
  normas_ref?: string[]
  etapas?: ProcedureStage[]
  notas?: string[]
}

export interface ProcedureIndex {
  version?: string
  procedures: ProcedureIndexEntry[]
}

let cachedIndex: ProcedureIndex | null = null

/**
 * Carga data/procedures/index.json
 */
export function loadProceduresIndex(): ProcedureIndex | null {
  if (cachedIndex) return cachedIndex
  const indexPath = path.join(PROCEDURES_DIR, 'index.json')
  if (!fs.existsSync(indexPath)) return null
  try {
    const raw = fs.readFileSync(indexPath, 'utf-8')
    cachedIndex = JSON.parse(raw) as ProcedureIndex
    return cachedIndex
  } catch {
    return null
  }
}

/**
 * Carga un procedimiento por id (archivo data/procedures/{id}.json o por file en index)
 */
export function loadProcedureDetail(idOrFile: string): ProcedureDetail | null {
  const base = idOrFile.endsWith('.json') ? idOrFile.replace('.json', '') : idOrFile
  const filePath = path.join(PROCEDURES_DIR, `${base}.json`)
  if (!fs.existsSync(filePath)) return null
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(raw) as ProcedureDetail
  } catch {
    return null
  }
}

/**
 * Genera timeline con fechas límite acumuladas (D+0, D+10, etc.) y documentos por etapa
 */
export function buildProcedureTimeline(
  proc: ProcedureDetail,
  startDate?: Date
): { timeline: string; documentosPorEtapa: Array<{ etapa: string; diasAcumulados: number; fechaLimite: string; documentos: string[] }> } {
  const base = startDate || new Date()
  const documentosPorEtapa: Array<{ etapa: string; diasAcumulados: number; fechaLimite: string; documentos: string[] }> = []
  let diasAcum = 0
  const timelineLines: string[] = ['Timeline (desde presentación):']

  if (!proc.etapas?.length) {
    return { timeline: timelineLines.join('\n'), documentosPorEtapa }
  }

  for (const e of proc.etapas) {
    const dias = e.plazos?.dias ?? 0
    diasAcum += dias
    const limite = new Date(base)
    limite.setDate(limite.getDate() + diasAcum)
    const fechaLimite = limite.toISOString().split('T')[0]
    const docList = e.documentos ?? []
    documentosPorEtapa.push({
      etapa: e.nombre,
      diasAcumulados: diasAcum,
      fechaLimite,
      documentos: docList
    })
    const plazoDesc = e.plazos?.descripcion || (dias > 0 ? `D+${diasAcum}` : 'inmediato')
    timelineLines.push(`- ${e.nombre}: ${plazoDesc} (fecha límite aprox. ${fechaLimite})`)
    if (docList.length > 0) {
      timelineLines.push('  Documentos: ' + docList.slice(0, 6).join('; ') + (docList.length > 6 ? '...' : ''))
    }
  }

  return {
    timeline: timelineLines.join('\n'),
    documentosPorEtapa
  }
}

/**
 * Convierte un procedimiento detallado a texto para contexto RAG (sin timeline)
 */
export function formatProcedureForContext(proc: ProcedureDetail): string {
  return formatProcedureWithTimeline(proc, undefined)
}

/**
 * Convierte un procedimiento detallado a texto para contexto RAG, con timeline y documentos por etapa
 */
export function formatProcedureWithTimeline(proc: ProcedureDetail, startDate?: Date): string {
  const lines: string[] = []
  lines.push(`Procedimiento: ${proc.nombre}`)
  if (proc.descripcion) lines.push(proc.descripcion)
  if (proc.normas_ref?.length) {
    lines.push('Normas: ' + proc.normas_ref.join('; '))
  }
  const { timeline, documentosPorEtapa } = buildProcedureTimeline(proc, startDate)
  lines.push('')
  lines.push(timeline)
  lines.push('')
  lines.push('Documentos requeridos por etapa:')
  for (const row of documentosPorEtapa) {
    if (row.documentos.length > 0) {
      lines.push(`- ${row.etapa} (hasta D+${row.diasAcumulados}): ${row.documentos.join(', ')}`)
    }
  }
  if (proc.notas?.length) {
    lines.push('')
    lines.push('Notas: ' + proc.notas.join(' '))
  }
  return lines.join('\n')
}

/**
 * Detecta si la consulta parece pedir información procedural (plazos, pasos, trámite, etc.)
 */
export function isProcedureRelatedQuery(query: string): boolean {
  const lower = query.toLowerCase()
  const terms = [
    'procedimiento', 'pasos', 'trámite', 'tramite', 'plazos', 'cuánto dura', 'cuanto dura',
    'qué documentos', 'que documentos', 'cómo presentar', 'como presentar', 'acción de tutela',
    'accion de tutela', 'acción de cumplimiento', 'accion de cumplimiento', 'demanda laboral',
    'proceso laboral', 'ordinario', 'verbal', 'etapas', 'términos', 'terminos'
  ]
  return terms.some(t => lower.includes(t))
}

/**
 * Devuelve ids de procedimientos relevantes según la consulta y el área legal
 */
export function getRelevantProcedureIds(query: string, legalArea?: string): string[] {
  const index = loadProceduresIndex()
  if (!index?.procedures?.length) return []

  const lower = query.toLowerCase()
  const ids: string[] = []

  for (const p of index.procedures) {
    const matchArea = !legalArea || p.tipo === legalArea ||
      (legalArea === 'administrativo' && (p.id === 'cumplimiento' || p.tipo === 'constitucional')) ||
      (legalArea === 'constitucional' && (p.id === 'tutela' || p.id === 'cumplimiento'))
    const matchQuery =
      lower.includes('tutela') && p.id === 'tutela' ||
      lower.includes('cumplimiento') && p.id === 'cumplimiento' ||
      (lower.includes('laboral') || lower.includes('prestaciones') || lower.includes('demanda')) &&
        (p.id.startsWith('laboral') || p.id === 'laboral')
    if (matchQuery || (matchArea && (lower.includes(p.nombre.toLowerCase()) || lower.includes(p.id)))) {
      ids.push(p.file?.replace('.json', '') || p.id)
    }
  }

  // Si no hubo match fino, devolver por área
  if (ids.length === 0 && legalArea) {
    for (const p of index.procedures) {
      if (p.tipo === legalArea || (legalArea === 'constitucional' && (p.id === 'tutela' || p.id === 'cumplimiento'))) {
        ids.push(p.file?.replace('.json', '') || p.id)
      }
    }
  }
  return ids.slice(0, 3) // Máximo 3 procedimientos
}

/**
 * Carga procedimientos relevantes para la consulta y los devuelve como chunks
 * para inyectar en el contexto RAG (aparecerán como fuentes adicionales).
 */
export function getProcedureChunksForQuery(
  query: string,
  legalArea?: string
): Array<{ chunk: DocumentChunk; score: number }> {
  if (!isProcedureRelatedQuery(query)) return []

  const ids = getRelevantProcedureIds(query, legalArea)
  const result: Array<{ chunk: DocumentChunk; score: number }> = []

  for (const id of ids) {
    const proc = loadProcedureDetail(id)
    if (!proc) continue
    const content = formatProcedureWithTimeline(proc)
    const chunkId = `procedimiento-${proc.id}`
    const chunk: DocumentChunk = {
      id: chunkId,
      content,
      metadata: {
        id: chunkId,
        title: proc.nombre,
        type: 'procedimiento'
      }
    }
    result.push({ chunk, score: 0.95 }) // Alta relevancia para que aparezca en contexto
  }
  return result
}
