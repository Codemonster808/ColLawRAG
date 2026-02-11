#!/usr/bin/env node
/**
 * Generador de Lista de Descarga - Jurisprudencia CC
 * 
 * Lee metadata existente y genera lista de URLs para descarga manual.
 * Útil cuando los scrapers automatizados son bloqueados con 403.
 * 
 * Uso:
 *   node scripts/generate-download-list.mjs
 *   node scripts/generate-download-list.mjs --year=2024
 *   node scripts/generate-download-list.mjs --type=tutela
 *   node scripts/generate-download-list.mjs --missing-only
 * 
 * @created 2026-02-10
 */

import { readFile, writeFile } from 'fs/promises';
import { existsSync, readdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==================== CONFIG ====================

const METADATA_PATH = path.join(process.cwd(), 'data', 'jurisprudencia', 'cc', 'metadata.json');
const OUTPUT_PATH = path.join(process.cwd(), 'data', 'jurisprudencia', 'cc', 'download-list.json');
const CC_DIR = path.join(process.cwd(), 'data', 'jurisprudencia', 'cc');

// ==================== HELPERS ====================

/**
 * Verifica si una sentencia ya existe en disco
 */
function sentenciaExists(sentenciaId, año) {
  const yearDir = path.join(CC_DIR, año.toString());
  if (!existsSync(yearDir)) return false;
  
  // Buscar archivo que coincida con el ID
  const files = readdirSync(yearDir);
  return files.some(f => f.includes(sentenciaId));
}

/**
 * Genera la lista de descarga desde metadata
 */
async function generateDownloadList(yearFilter = null, tipoFilter = null, missingOnly = false) {
  console.log('\n========================================');
  console.log('GENERADOR DE LISTA DE DESCARGA');
  console.log('========================================\n');
  
  // Cargar metadata
  if (!existsSync(METADATA_PATH)) {
    console.error('[ERROR] No existe metadata.json');
    process.exit(1);
  }
  
  const metadataContent = await readFile(METADATA_PATH, 'utf-8');
  const metadata = JSON.parse(metadataContent);
  
  console.log(`[INFO] Cargado metadata con ${Object.keys(metadata).length} entradas\n`);
  
  // Generar lista
  const downloadList = [];
  const stats = {
    total: 0,
    pendientes: 0,
    yaExisten: 0,
    porTipo: {},
    porAño: {}
  };
  
  for (const [sentenciaId, data] of Object.entries(metadata)) {
    // Filtros
    if (yearFilter && data.año !== yearFilter) continue;
    if (tipoFilter && data.tipo !== tipoFilter) continue;
    
    stats.total++;
    stats.porTipo[data.tipo] = (stats.porTipo[data.tipo] || 0) + 1;
    stats.porAño[data.año] = (stats.porAño[data.año] || 0) + 1;
    
    // Verificar si ya existe
    const exists = sentenciaExists(sentenciaId, data.año);
    
    if (exists) {
      stats.yaExisten++;
      if (missingOnly) continue; // Skip si solo queremos las faltantes
    } else {
      stats.pendientes++;
    }
    
    // Agregar a lista
    downloadList.push({
      id: sentenciaId,
      tipo: data.tipo,
      tipoCode: data.tipoCode,
      numero: data.numero,
      año: data.año,
      url: data.url,
      magistrado: data.magistrado,
      fecha: data.fecha,
      estado: exists ? 'existente' : 'pendiente',
      prioridad: getPrioridad(data),
      notas: exists ? 'Archivo ya existe en disco' : 'Pendiente de descarga'
    });
  }
  
  // Ordenar por prioridad (pendientes primero)
  downloadList.sort((a, b) => {
    if (a.estado === 'pendiente' && b.estado !== 'pendiente') return -1;
    if (a.estado !== 'pendiente' && b.estado === 'pendiente') return 1;
    return b.prioridad - a.prioridad;
  });
  
  // Guardar lista
  await writeFile(OUTPUT_PATH, JSON.stringify(downloadList, null, 2), 'utf-8');
  
  console.log(`[SAVED] Lista de descarga: ${OUTPUT_PATH}`);
  console.log(`\nTotal de sentencias: ${stats.total}`);
  console.log(`Pendientes de descarga: ${stats.pendientes}`);
  console.log(`Ya existen: ${stats.yaExisten}`);
  
  console.log('\nPor tipo:');
  for (const [tipo, count] of Object.entries(stats.porTipo)) {
    console.log(`  ${tipo}: ${count}`);
  }
  
  console.log('\nPor año:');
  for (const [año, count] of Object.entries(stats.porAño)) {
    console.log(`  ${año}: ${count}`);
  }
  
  // Generar README de instrucciones
  await generateReadme(downloadList, stats);
  
  console.log('\n========================================');
  console.log('LISTA GENERADA EXITOSAMENTE');
  console.log('========================================\n');
  
  console.log(`📄 Lista de descarga: ${OUTPUT_PATH}`);
  console.log(`📖 Instrucciones: data/jurisprudencia/cc/README-DOWNLOAD.md`);
  console.log(`\n🔗 Primeras URLs pendientes:\n`);
  
  const pendientes = downloadList.filter(s => s.estado === 'pendiente').slice(0, 5);
  for (const s of pendientes) {
    console.log(`  ${s.id}: ${s.url}`);
  }
  
  console.log('\n');
}

/**
 * Calcula prioridad de descarga (1-10)
 */
function getPrioridad(data) {
  let prioridad = 5; // Base
  
  // Sentencias más recientes tienen mayor prioridad
  const año = parseInt(data.año);
  if (año >= 2024) prioridad += 3;
  else if (año >= 2022) prioridad += 2;
  else if (año >= 2020) prioridad += 1;
  
  // Tutelas tienen mayor prioridad (más comunes en consultas)
  if (data.tipo === 'tutela') prioridad += 1;
  
  // Sentencias de unificación tienen alta prioridad (precedente)
  if (data.tipo === 'unificacion') prioridad += 2;
  
  return Math.min(prioridad, 10);
}

/**
 * Genera README con instrucciones de descarga manual
 */
async function generateReadme(downloadList, stats) {
  const readmePath = path.join(CC_DIR, 'README-DOWNLOAD.md');
  
  const readme = `# Instrucciones de Descarga Manual - Jurisprudencia CC

**Generado**: ${new Date().toISOString().split('T')[0]}  
**Total de sentencias**: ${stats.total}  
**Pendientes de descarga**: ${stats.pendientes}  
**Ya existentes**: ${stats.yaExisten}

## 📋 Lista de Descarga

La lista completa de URLs está en: \`download-list.json\`

**Formato**:
\`\`\`json
{
  "id": "T-010-2024",
  "tipo": "tutela",
  "numero": "010",
  "año": "2024",
  "url": "https://www.corteconstitucional.gov.co/relatoria/2024/T-010-2024.htm",
  "estado": "pendiente",
  "prioridad": 8,
  "notas": "Pendiente de descarga"
}
\`\`\`

## 🔧 Proceso de Descarga Manual

### Opción 1: Descarga Individual (Browser)

1. Abrir las URLs en el navegador
2. Guardar HTML completo (Ctrl+S / Cmd+S)
3. Guardar en: \`data/jurisprudencia/cc/downloads/\`
4. Nombrar archivos: \`{id}.html\` (ej: \`T-010-2024.html\`)

### Opción 2: Descarga con wget/curl (Terminal)

\`\`\`bash
# Crear directorio
mkdir -p data/jurisprudencia/cc/downloads

# Descargar sentencias (ejemplo con primeras 10)
jq -r '.[] | select(.estado == "pendiente") | .url' data/jurisprudencia/cc/download-list.json | head -10 | while read url; do
  filename=$(echo $url | grep -oP '[A-Z]+-\\d+-\\d+')
  curl -A "Mozilla/5.0" "$url" > "data/jurisprudencia/cc/downloads/$filename.html"
  sleep 5 # Delay para evitar bloqueo
done
\`\`\`

### Opción 3: Extensión de Navegador

1. Instalar extensión: **DownThemAll** o **Tab Save**
2. Abrir todas las URLs en tabs
3. Usar extensión para guardar todos los HTMLs

## ⚙️ Procesar Archivos Descargados

Una vez descargados los HTMLs, procesarlos con:

\`\`\`bash
node scripts/process-downloaded-files.mjs
\`\`\`

Este script:
- Lee archivos HTML de \`downloads/\`
- Extrae y limpia el texto
- Guarda en formato estándar: \`sentencia-{tipo}-{numero}-{año}.txt\`
- Actualiza \`metadata.json\`

## 📊 Priorización de Descargas

**Alta prioridad** (prioridad 8-10):
- Sentencias 2024-2025
- Sentencias de unificación (SU)
- Tutelas recientes

**Media prioridad** (prioridad 5-7):
- Sentencias 2022-2023
- Constitucionalidad

**Baja prioridad** (prioridad 1-4):
- Sentencias 2020-2021
- Ya existen en disco

## 🔍 Verificar Estado

\`\`\`bash
# Ver sentencias pendientes
jq '.[] | select(.estado == "pendiente") | .id' data/jurisprudencia/cc/download-list.json

# Ver estadísticas
jq 'group_by(.estado) | map({estado: .[0].estado, count: length})' data/jurisprudencia/cc/download-list.json
\`\`\`

## 📝 Notas Importantes

- **Delays**: Esperar 5-10 segundos entre descargas para evitar bloqueo
- **User-Agent**: Usar User-Agent de navegador real
- **Referer**: Agregar header \`Referer: https://www.google.com/\`
- **VPN/Proxy**: Considerar usar VPN si hay bloqueos persistentes

## 🔗 URLs Importantes

- **Relatoria CC**: https://www.corteconstitucional.gov.co/relatoria/
- **Consulta sentencias**: https://www.corteconstitucional.gov.co/secretaria/
- **Contacto**: secretaria@corteconstitucional.gov.co

---

**Generado automáticamente por**: \`scripts/generate-download-list.mjs\`
`;
  
  await writeFile(readmePath, readme, 'utf-8');
  console.log(`[SAVED] README de instrucciones: ${readmePath}`);
}

// ==================== MAIN ====================

async function main() {
  const args = process.argv.slice(2);
  const yearArg = args.find(a => a.startsWith('--year'));
  const tipoArg = args.find(a => a.startsWith('--type'));
  const missingOnly = args.includes('--missing-only');
  
  const yearFilter = yearArg ? yearArg.split('=')[1] : null;
  const tipoFilter = tipoArg ? tipoArg.split('=')[1] : null;
  
  if (args.includes('--help')) {
    console.log(`
Uso:
  node scripts/generate-download-list.mjs
  node scripts/generate-download-list.mjs --year=2024
  node scripts/generate-download-list.mjs --type=tutela
  node scripts/generate-download-list.mjs --missing-only

Opciones:
  --year=YYYY       Solo sentencias de año específico
  --type=TYPE       Solo sentencias de tipo específico (tutela, constitucionalidad, unificacion)
  --missing-only    Solo incluir sentencias que NO existen en disco
  --help            Mostrar esta ayuda
`);
    process.exit(0);
  }
  
  await generateDownloadList(yearFilter, tipoFilter, missingOnly);
}

main().catch(console.error);
