#!/usr/bin/env node
/**
 * Convierte JSONs de data/normas-vigencia/ a TXT enriquecidos para ingesta RAG
 * 
 * El texto generado sigue el mismo formato que data/documents/*.txt:
 * - Frontmatter con metadata (tipo, área, fuente)
 * - Texto estructurado por artículos (para splitByArticles())
 * - Incluye toda la información especializada del JSON
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join, basename } from 'path';

const NORMAS_DIR = join(process.cwd(), 'data', 'normas-vigencia');
const OUT_DIR = join(process.cwd(), 'data', 'documents');

function jsonToEnrichedTxt(json, filename) {
  const lines = [];

  // ===== FRONTMATTER =====
  const nombre = json.nombre || json.normaId || basename(filename, '.json');
  const tipo = json.tipo || 'ley';
  const area = json.ambito || json.materia || detectArea(json);
  const fuente = json.emisor || 'Congreso de la República';
  const url = json.url || '';
  const estado = json.estado || 'vigente';

  lines.push(`# ${nombre}`);
  lines.push('');
  lines.push(`tipo: ${tipo}`);
  lines.push(`area: ${area}`);
  lines.push(`fuente: ${fuente}`);
  if (url) lines.push(`url: ${url}`);
  lines.push(`estado: ${estado}`);
  lines.push(`vigente_desde: ${json.vigenteDesde || ''}`);
  if (json.vigenteHasta) lines.push(`vigente_hasta: ${json.vigenteHasta}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // ===== DESCRIPCIÓN GENERAL =====
  if (json.descripcion) {
    lines.push('DESCRIPCIÓN GENERAL');
    lines.push('');
    lines.push(json.descripcion);
    lines.push('');
  }

  if (json.objetoPrincipal) {
    lines.push('OBJETO PRINCIPAL');
    lines.push('');
    lines.push(typeof json.objetoPrincipal === 'string' 
      ? json.objetoPrincipal 
      : JSON.stringify(json.objetoPrincipal, null, 2));
    lines.push('');
  }

  // ===== DEFINICIONES Y CONCEPTOS CLAVE =====
  const definitionFields = [
    'definicion', 'definicionAcosoLaboral', 'definiciones', 'conceptos',
    'terminosImportantes', 'conceptosClave', 'principios', 'objetivos'
  ];
  
  for (const field of definitionFields) {
    if (json[field]) {
      lines.push(fieldTitle(field));
      lines.push('');
      lines.push(formatValue(json[field]));
      lines.push('');
    }
  }

  // ===== ARTÍCULOS RELEVANTES (si existen) =====
  if (json.articulosRelevantes && Array.isArray(json.articulosRelevantes)) {
    lines.push('ARTÍCULOS RELEVANTES');
    lines.push('');
    for (const art of json.articulosRelevantes) {
      if (art.numero) {
        lines.push(`Artículo ${art.numero}. ${art.titulo || ''}`);
        if (art.texto) lines.push(art.texto);
        if (art.nota) lines.push(`Nota: ${art.nota}`);
        if (art.modificaciones && Array.isArray(art.modificaciones)) {
          for (const mod of art.modificaciones) {
            lines.push(`  Modificado por: ${mod.norma || mod.ley || ''} - ${mod.descripcion || ''}`);
          }
        }
        lines.push('');
      } else if (typeof art === 'string') {
        lines.push(art);
        lines.push('');
      } else {
        lines.push(JSON.stringify(art));
        lines.push('');
      }
    }
  }

  // ===== CONTENIDO ESPECIALIZADO (todos los demás campos) =====
  const skipFields = new Set([
    'normaId', 'nombre', 'tipo', 'vigenteDesde', 'vigenteHasta', 'estado',
    'ambito', 'materia', 'emisor', 'publicacion', 'url', 'descripcion',
    'objetoPrincipal', 'articulosRelevantes', 'jurisprudenciaRelevante',
    'relacionConOtrasNormas', 'estadisticas', 'notas',
    ...definitionFields
  ]);

  for (const [field, value] of Object.entries(json)) {
    if (skipFields.has(field) || !value) continue;
    
    lines.push(fieldTitle(field));
    lines.push('');
    lines.push(formatValue(value));
    lines.push('');
  }

  // ===== JURISPRUDENCIA =====
  if (json.jurisprudenciaRelevante && Array.isArray(json.jurisprudenciaRelevante)) {
    lines.push('JURISPRUDENCIA RELEVANTE');
    lines.push('');
    for (const j of json.jurisprudenciaRelevante) {
      if (j.sentencia) {
        lines.push(`${j.sentencia}${j.magistrado ? ` - M.P. ${j.magistrado}` : ''}${j.fecha ? ` (${j.fecha})` : ''}`);
        if (j.tema) lines.push(`Tema: ${j.tema}`);
        if (j.descripcion) lines.push(j.descripcion);
        if (j.reglaDerecho) lines.push(`Regla: ${j.reglaDerecho}`);
        lines.push('');
      } else if (typeof j === 'string') {
        lines.push(j);
        lines.push('');
      }
    }
  }

  // ===== RELACIÓN CON OTRAS NORMAS =====
  if (json.relacionConOtrasNormas) {
    lines.push('RELACIÓN CON OTRAS NORMAS');
    lines.push('');
    lines.push(formatValue(json.relacionConOtrasNormas));
    lines.push('');
  }

  // ===== ESTADÍSTICAS (si existen) =====
  if (json.estadisticas) {
    lines.push('ESTADÍSTICAS Y DATOS');
    lines.push('');
    lines.push(formatValue(json.estadisticas));
    lines.push('');
  }

  // ===== NOTAS Y ACLARACIONES =====
  if (json.notas) {
    lines.push('NOTAS Y ACLARACIONES');
    lines.push('');
    lines.push(formatValue(json.notas));
    lines.push('');
  }

  return lines.join('\n');
}

function detectArea(json) {
  const text = JSON.stringify(json).toLowerCase();
  if (text.includes('trabajo') || text.includes('laboral') || text.includes('emplead')) return 'laboral';
  if (text.includes('tribut') || text.includes('impuest') || text.includes('renta')) return 'tributario';
  if (text.includes('comerci') || text.includes('sociedad') || text.includes('mercant')) return 'comercial';
  if (text.includes('penal') || text.includes('delito') || text.includes('crimen')) return 'penal';
  if (text.includes('administrat') || text.includes('petici') || text.includes('cumplimiento')) return 'administrativo';
  if (text.includes('constitu') || text.includes('tutela') || text.includes('derecho fundamental')) return 'constitucional';
  if (text.includes('civil') || text.includes('sucesi') || text.includes('contrato civil')) return 'civil';
  return 'general';
}

function fieldTitle(field) {
  const titles = {
    modalidadesAcosoLaboral: 'MODALIDADES DE ACOSO LABORAL',
    conductasAcosoLaboral: 'CONDUCTAS QUE CONSTITUYEN ACOSO LABORAL',
    conductasQueNOSonAcoso: 'CONDUCTAS QUE NO SON ACOSO LABORAL',
    mecanismosPrevencion: 'MECANISMOS DE PREVENCIÓN',
    procedimientoQueja: 'PROCEDIMIENTO DE QUEJA',
    sanciones: 'SANCIONES',
    recomendacionesVictimas: 'RECOMENDACIONES PARA VÍCTIMAS',
    dificultadesAplicacion: 'DIFICULTADES DE APLICACIÓN',
    derechosGarantizados: 'DERECHOS GARANTIZADOS',
    obligacionesEmpleador: 'OBLIGACIONES DEL EMPLEADOR',
    beneficiosEmpleado: 'BENEFICIOS DEL EMPLEADO',
    beneficiosTrabajador: 'BENEFICIOS DEL TRABAJADOR',
    prestacionesSociales: 'PRESTACIONES SOCIALES',
    terminacionContrato: 'TERMINACIÓN DEL CONTRATO',
    jornadaLaboral: 'JORNADA LABORAL',
    salarioMinimoLegal: 'SALARIO MÍNIMO LEGAL',
    reglasClave: 'REGLAS CLAVE',
    camposAplicacion: 'CAMPOS DE APLICACIÓN',
    requisitosViabilidad: 'REQUISITOS DE VIABILIDAD',
    procedimiento: 'PROCEDIMIENTO',
    procedimientoDetallado: 'PROCEDIMIENTO DETALLADO',
    procedimientoAccion: 'PROCEDIMIENTO DE LA ACCIÓN',
    efectos: 'EFECTOS',
    plazos: 'PLAZOS',
    legitimadosActivos: 'LEGITIMADOS PARA INTERPONER LA ACCIÓN',
    demandados: 'DEMANDADOS',
    competencia: 'COMPETENCIA',
    terminosFormulacion: 'TÉRMINOS DE FORMULACIÓN',
    cumplimientoForzoso: 'CUMPLIMIENTO FORZOSO',
    proteccionDerechosPeticion: 'PROTECCIÓN DEL DERECHO DE PETICIÓN',
    tiposPeticiones: 'TIPOS DE PETICIONES',
    obligacionesEntidades: 'OBLIGACIONES DE LAS ENTIDADES',
    derechosPeticionario: 'DERECHOS DEL PETICIONARIO',
    incumplimientoContenido: 'INCUMPLIMIENTO Y SANCIONES',
    contratos: 'CONTRATOS LABORALES',
    tiposContrato: 'TIPOS DE CONTRATO',
  };
  
  return titles[field] || field.replace(/([A-Z])/g, ' $1').toUpperCase().trim();
}

function formatValue(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.map(item => {
      if (typeof item === 'string') return `- ${item}`;
      if (typeof item === 'object' && item !== null) {
        const parts = [];
        for (const [k, v] of Object.entries(item)) {
          if (v && typeof v === 'string') parts.push(`${k}: ${v}`);
          else if (v && Array.isArray(v)) parts.push(`${k}:\n${v.map(x => '  - ' + x).join('\n')}`);
        }
        return '- ' + parts.join('\n  ');
      }
      return String(item);
    }).join('\n');
  }
  if (typeof value === 'object' && value !== null) {
    const parts = [];
    for (const [k, v] of Object.entries(value)) {
      if (!v) continue;
      if (typeof v === 'string') parts.push(`${k}: ${v}`);
      else if (Array.isArray(v)) parts.push(`${k}:\n${v.map(x => '  - ' + (typeof x === 'string' ? x : JSON.stringify(x))).join('\n')}`);
      else if (typeof v === 'object') parts.push(`${k}:\n${JSON.stringify(v, null, 2)}`);
    }
    return parts.join('\n');
  }
  return String(value);
}

// ===== MAIN =====
const files = readdirSync(NORMAS_DIR).filter(f => f.endsWith('.json') && f !== 'README.md');
console.log(`\n📚 Procesando ${files.length} normas-vigencia JSON → TXT enriquecido\n`);

let converted = 0;
let skipped = 0;

for (const file of files) {
  const jsonPath = join(NORMAS_DIR, file);
  const txtName = `norma_vigencia_${file.replace('.json', '.txt')}`;
  const txtPath = join(OUT_DIR, txtName);

  try {
    const json = JSON.parse(readFileSync(jsonPath, 'utf-8'));
    const txt = jsonToEnrichedTxt(json, file);
    
    if (txt.length < 200) {
      console.log(`  ⚠️  ${file} → TXT muy pequeño (${txt.length} chars), saltando`);
      skipped++;
      continue;
    }
    
    writeFileSync(txtPath, txt, 'utf-8');
    console.log(`  ✅ ${file} → ${txtName} (${txt.length.toLocaleString()} chars)`);
    converted++;
  } catch (err) {
    console.error(`  ❌ ${file}: ${err.message}`);
    skipped++;
  }
}

console.log(`\n✅ Completado: ${converted} convertidos, ${skipped} saltados`);
console.log(`\nAhora ejecuta: npm run ingest\n`);
