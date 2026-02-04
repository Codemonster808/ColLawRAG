/**
 * Sistema de gestión de vigencia y derogación de normas legales
 * 
 * Permite:
 * - Consultar estado de vigencia de una norma en una fecha específica
 * - Registrar derogaciones totales o parciales
 * - Rastrear modificaciones y vigencias temporales
 * - Filtrar normas por estado de vigencia
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

export interface DerogacionParcial {
  /** Artículo, inciso o parte derogada */
  articulo?: string;
  /** Norma que deroga */
  derogadoPor: string;
  /** Fecha desde la cual está derogada */
  derogadaDesde: string;
  /** Razón o motivo de la derogación */
  razon?: string;
}

export interface Modificacion {
  /** Norma que modifica */
  norma: string;
  /** Fecha de la modificación */
  fecha: string;
  /** Tipo de modificación */
  tipo: 'modificacion' | 'adicion' | 'subrogacion' | 'aclaracion';
  /** Descripción de la modificación */
  descripcion?: string;
}

export interface NormaVigencia {
  /** Identificador único (ej: ley-100-1993, decreto-2591-1991) */
  normaId: string;
  /** Nombre completo de la norma */
  nombre: string;
  /** Tipo de norma */
  tipo: 'ley' | 'decreto' | 'acto_legislativo' | 'codigo' | 'resolucion' | 'acuerdo';
  /** Fecha desde la cual está vigente (YYYY-MM-DD) */
  vigenteDesde: string;
  /** Fecha hasta la cual está vigente (null si aún está vigente) */
  vigenteHasta: string | null;
  /** Norma que deroga completamente (si aplica) */
  derogadaPor?: string;
  /** Fecha de derogación total (si aplica) */
  derogadaDesde?: string;
  /** Derogaciones parciales (artículos específicos) */
  derogacionesParciales?: DerogacionParcial[];
  /** Modificaciones recibidas */
  modificaciones?: Modificacion[];
  /** Estado actual */
  estado: 'vigente' | 'derogada' | 'parcialmente_derogada';
  /** Notas adicionales */
  notas?: string[];
}

export type EstadoVigencia = 
  | { vigente: true; estado: 'vigente' }
  | { vigente: false; estado: 'derogada'; derogadaPor?: string; derogadaDesde?: string }
  | { vigente: true; estado: 'parcialmente_derogada'; derogaciones: DerogacionParcial[] };

/**
 * Directorio donde se almacenan los datos de vigencia
 */
const DATA_DIR = join(process.cwd(), 'data', 'normas-vigencia');

/**
 * Carga una norma desde el sistema de archivos
 */
export function loadNorma(normaId: string): NormaVigencia | null {
  const filePath = join(DATA_DIR, `${normaId}.json`);
  
  if (!existsSync(filePath)) {
    return null;
  }
  
  try {
    const content = readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as NormaVigencia;
  } catch (error) {
    console.error(`Error al cargar norma ${normaId}:`, error);
    return null;
  }
}

/**
 * Guarda una norma en el sistema de archivos
 */
export function saveNorma(norma: NormaVigencia): void {
  const filePath = join(DATA_DIR, `${norma.normaId}.json`);
  
  try {
    writeFileSync(filePath, JSON.stringify(norma, null, 2), 'utf-8');
  } catch (error) {
    console.error(`Error al guardar norma ${norma.normaId}:`, error);
    throw error;
  }
}

/**
 * Lista todas las normas disponibles
 */
export function listNormas(): string[] {
  if (!existsSync(DATA_DIR)) {
    return [];
  }
  
  return readdirSync(DATA_DIR)
    .filter(file => file.endsWith('.json') && file !== 'README.md')
    .map(file => file.replace('.json', ''));
}

/** Mapeo título conocido → normaId para títulos que no siguen "Ley X de YYYY" */
const TITULO_A_NORMA_ID: Record<string, string> = {
  'código penal': 'ley-599-2000',
  'codigo penal': 'ley-599-2000',
  'ley 599 de 2000': 'ley-599-2000',
  'ley 100 de 1993': 'ley-100-1993',
  'decreto 2591 de 1991': 'decreto-2591-1991',
  'ley 1437 de 2011': 'ley-1437-2011',
  'código de procedimiento administrativo': 'ley-1437-2011',
  'cpaca': 'ley-1437-2011',
  'ley 50 de 1990': 'ley-50-1990',
  'ley 57 de 1887': 'ley-57-1887'
}

/**
 * Infiere un normaId a partir del título de una cita (ej. "Ley 599 de 2000 (Código Penal)" → ley-599-2000).
 * Útil para consultar vigencia desde el RAG.
 */
export function inferNormaIdFromTitle(title: string): string | null {
  if (!title || typeof title !== 'string') return null
  const normalized = title.toLowerCase().trim()
  const known = listNormas()

  // 1) Coincidencia exacta por slug desde "Ley X de YYYY" / "Decreto X de YYYY"
  const leyMatch = normalized.match(/\bley\s+(\d+)\s+de\s+(\d{4})\b/)
  if (leyMatch) {
    const slug = `ley-${leyMatch[1]}-${leyMatch[2]}`
    if (known.includes(slug)) return slug
  }
  const decretoMatch = normalized.match(/\bdecreto\s+(\d+)\s+de\s+(\d{4})\b/)
  if (decretoMatch) {
    const slug = `decreto-${decretoMatch[1]}-${decretoMatch[2]}`
    if (known.includes(slug)) return slug
  }

  // 2) Lookup en mapa de títulos conocidos
  for (const [key, id] of Object.entries(TITULO_A_NORMA_ID)) {
    if (normalized.includes(key) && known.includes(id)) return id
  }

  // 3) Buscar por nombre en normas cargadas
  for (const id of known) {
    const norma = loadNorma(id)
    if (norma?.nombre && normalized.includes(norma.nombre.toLowerCase())) return id
  }
  return null
}

/**
 * Consulta el estado de vigencia de una norma en una fecha específica
 * 
 * @param normaId Identificador de la norma
 * @param fecha Fecha de consulta (YYYY-MM-DD). Si no se especifica, usa la fecha actual
 * @returns Estado de vigencia o null si la norma no existe
 */
export function consultarVigencia(normaId: string, fecha?: string): EstadoVigencia | null {
  const norma = loadNorma(normaId);
  
  if (!norma) {
    return null;
  }
  
  const fechaConsulta = fecha || new Date().toISOString().split('T')[0];
  const fechaDate = new Date(fechaConsulta);
  const vigenteDesdeDate = new Date(norma.vigenteDesde);
  
  // Verificar si la norma ya estaba vigente en la fecha de consulta
  if (fechaDate < vigenteDesdeDate) {
    return {
      vigente: false,
      estado: 'derogada',
      derogadaDesde: 'antes de entrar en vigencia'
    };
  }
  
  // Verificar si la norma ya fue derogada completamente
  if (norma.vigenteHasta) {
    const vigenteHastaDate = new Date(norma.vigenteHasta);
    if (fechaDate > vigenteHastaDate) {
      return {
        vigente: false,
        estado: 'derogada',
        derogadaPor: norma.derogadaPor,
        derogadaDesde: norma.vigenteHasta
      };
    }
  }
  
  // Verificar derogaciones parciales
  if (norma.derogacionesParciales && norma.derogacionesParciales.length > 0) {
    const derogacionesAplicables = norma.derogacionesParciales.filter(der => {
      const derogadaDesdeDate = new Date(der.derogadaDesde);
      return fechaDate >= derogadaDesdeDate;
    });
    
    if (derogacionesAplicables.length > 0) {
      return {
        vigente: true,
        estado: 'parcialmente_derogada',
        derogaciones: derogacionesAplicables
      };
    }
  }
  
  // Norma vigente completamente
  return {
    vigente: true,
    estado: 'vigente'
  };
}

/**
 * Registra una derogación total de una norma
 * 
 * @param normaId Norma que se deroga
 * @param derogadaPor Norma que deroga
 * @param fechaDerogacion Fecha de derogación (YYYY-MM-DD)
 */
export function registrarDerogacionTotal(
  normaId: string,
  derogadaPor: string,
  fechaDerogacion: string
): void {
  const norma = loadNorma(normaId);
  
  if (!norma) {
    throw new Error(`Norma ${normaId} no encontrada`);
  }
  
  norma.vigenteHasta = fechaDerogacion;
  norma.derogadaPor = derogadaPor;
  norma.derogadaDesde = fechaDerogacion;
  norma.estado = 'derogada';
  
  saveNorma(norma);
}

/**
 * Registra una derogación parcial (artículos específicos)
 * 
 * @param normaId Norma que se deroga parcialmente
 * @param derogacion Información de la derogación parcial
 */
export function registrarDerogacionParcial(
  normaId: string,
  derogacion: DerogacionParcial
): void {
  const norma = loadNorma(normaId);
  
  if (!norma) {
    throw new Error(`Norma ${normaId} no encontrada`);
  }
  
  if (!norma.derogacionesParciales) {
    norma.derogacionesParciales = [];
  }
  
  norma.derogacionesParciales.push(derogacion);
  norma.estado = 'parcialmente_derogada';
  
  saveNorma(norma);
}

/**
 * Registra una modificación a una norma
 * 
 * @param normaId Norma que se modifica
 * @param modificacion Información de la modificación
 */
export function registrarModificacion(
  normaId: string,
  modificacion: Modificacion
): void {
  const norma = loadNorma(normaId);
  
  if (!norma) {
    throw new Error(`Norma ${normaId} no encontrada`);
  }
  
  if (!norma.modificaciones) {
    norma.modificaciones = [];
  }
  
  norma.modificaciones.push(modificacion);
  
  saveNorma(norma);
}

/**
 * Crea una nueva norma en el sistema
 * 
 * @param norma Datos de la norma
 */
export function crearNorma(norma: NormaVigencia): void {
  const existe = loadNorma(norma.normaId);
  
  if (existe) {
    throw new Error(`Norma ${norma.normaId} ya existe`);
  }
  
  saveNorma(norma);
}

/**
 * Filtra normas por estado de vigencia en una fecha específica
 * 
 * @param estado Estado deseado
 * @param fecha Fecha de consulta (YYYY-MM-DD). Si no se especifica, usa la fecha actual
 * @returns Lista de IDs de normas que cumplen el criterio
 */
export function filtrarPorEstado(
  estado: 'vigente' | 'derogada' | 'parcialmente_derogada',
  fecha?: string
): string[] {
  const normas = listNormas();
  const resultado: string[] = [];
  
  for (const normaId of normas) {
    const vigencia = consultarVigencia(normaId, fecha);
    
    if (vigencia && vigencia.estado === estado) {
      resultado.push(normaId);
    }
  }
  
  return resultado;
}

/**
 * Obtiene todas las normas que derogan a una norma específica
 * 
 * @param normaId Norma a consultar
 * @returns Lista de normas que la derogan (total o parcialmente)
 */
export function obtenerNormasQueDerrogan(normaId: string): {
  total?: string;
  parciales: { norma: string; articulo?: string; fecha: string }[];
} {
  const norma = loadNorma(normaId);
  
  if (!norma) {
    throw new Error(`Norma ${normaId} no encontrada`);
  }
  
  const resultado: {
    total?: string;
    parciales: { norma: string; articulo?: string; fecha: string }[];
  } = {
    parciales: []
  };
  
  if (norma.derogadaPor) {
    resultado.total = norma.derogadaPor;
  }
  
  if (norma.derogacionesParciales) {
    resultado.parciales = norma.derogacionesParciales.map(der => ({
      norma: der.derogadoPor,
      articulo: der.articulo,
      fecha: der.derogadaDesde
    }));
  }
  
  return resultado;
}

/**
 * Genera un reporte de vigencia de una norma
 * 
 * @param normaId Norma a consultar
 * @returns Reporte en formato legible
 */
export function generarReporte(normaId: string): string {
  const norma = loadNorma(normaId);
  
  if (!norma) {
    return `Norma ${normaId} no encontrada`;
  }
  
  const vigenciaActual = consultarVigencia(normaId);
  
  let reporte = `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  reporte += `📋 REPORTE DE VIGENCIA\n`;
  reporte += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  reporte += `Norma: ${norma.nombre}\n`;
  reporte += `ID: ${norma.normaId}\n`;
  reporte += `Tipo: ${norma.tipo}\n\n`;
  
  reporte += `📅 Vigencia:\n`;
  reporte += `  Desde: ${norma.vigenteDesde}\n`;
  reporte += `  Hasta: ${norma.vigenteHasta || 'Actualmente vigente'}\n\n`;
  
  reporte += `Estado actual: `;
  if (vigenciaActual) {
    if (vigenciaActual.estado === 'vigente') {
      reporte += `✅ VIGENTE\n`;
    } else if (vigenciaActual.estado === 'derogada') {
      reporte += `❌ DEROGADA\n`;
      if ('derogadaPor' in vigenciaActual && vigenciaActual.derogadaPor) {
        reporte += `  Derogada por: ${vigenciaActual.derogadaPor}\n`;
      }
      if ('derogadaDesde' in vigenciaActual && vigenciaActual.derogadaDesde) {
        reporte += `  Desde: ${vigenciaActual.derogadaDesde}\n`;
      }
    } else if (vigenciaActual.estado === 'parcialmente_derogada') {
      reporte += `⚠️  PARCIALMENTE DEROGADA\n`;
      if ('derogaciones' in vigenciaActual) {
        reporte += `\n  Derogaciones parciales:\n`;
        vigenciaActual.derogaciones.forEach(der => {
          reporte += `    • ${der.articulo || 'Sección'}\n`;
          reporte += `      Derogada por: ${der.derogadoPor}\n`;
          reporte += `      Desde: ${der.derogadaDesde}\n`;
          if (der.razon) {
            reporte += `      Razón: ${der.razon}\n`;
          }
        });
      }
    }
  }
  
  if (norma.modificaciones && norma.modificaciones.length > 0) {
    reporte += `\n📝 Modificaciones:\n`;
    norma.modificaciones.forEach(mod => {
      reporte += `  • ${mod.norma} (${mod.fecha})\n`;
      reporte += `    Tipo: ${mod.tipo}\n`;
      if (mod.descripcion) {
        reporte += `    ${mod.descripcion}\n`;
      }
    });
  }
  
  if (norma.notas && norma.notas.length > 0) {
    reporte += `\n📌 Notas:\n`;
    norma.notas.forEach(nota => {
      reporte += `  • ${nota}\n`;
    });
  }
  
  reporte += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  
  return reporte;
}
