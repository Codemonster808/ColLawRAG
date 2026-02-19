import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { createWriteStream } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'

// Cargar variables de entorno desde .env.local
const envPath = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=')
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').replace(/^["']|["']$/g, '')
        if (!process.env[key]) {
          process.env[key] = value
        }
      }
    }
  }
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DOCS_DIR = path.join(process.cwd(), 'data', 'documents')
const OUT_PATH = path.join(process.cwd(), 'data', 'index.json')

function guessTypeFromFilename(name) {
  const lower = name.toLowerCase()
  if (lower.startsWith('estatuto_')) return 'estatuto'
  if (lower.startsWith('jurisprudencia_') || lower.includes('sentencia_')) return 'jurisprudencia'
  if (lower.startsWith('reglamento_')) return 'reglamento'
  if (lower.startsWith('codigo_')) return 'estatuto' // Códigos son estatutos
  if (lower.startsWith('ley_')) return 'estatuto' // Leyes son estatutos
  if (lower.startsWith('constitucion_')) return 'estatuto' // Constitución es estatuto
  if (lower.startsWith('decreto_')) return 'estatuto' // Decretos son estatutos
  return 'estatuto'
}

/**
 * Parsea frontmatter YAML entre --- del contenido raw.
 * Devuelve { area?, tipo?, ... } para usar en metadata (retrieval filtra por metadata.area).
 */
function parseFrontmatter(raw) {
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---/)
  if (!match) return {}
  const block = match[1]
  const out = {}
  for (const line of block.split('\n')) {
    const m = line.match(/^(\w[\w_-]*)\s*:\s*(.*)$/)
    if (m) {
      const key = m[1].trim().toLowerCase().replace(/_/g, '_')
      const val = m[2].trim().replace(/^["']|["']$/g, '')
      if (key === 'area' || key === 'area_legal') out.area = val
      else if (key === 'tipo') out.tipo = val
      else out[m[1].trim()] = val
    }
  }
  return out
}

/**
 * Parsea cabecera alternativa: líneas "Clave: valor" antes de ======== o ---.
 * Usado por decretos (Tema:, Ministerio/Entidad:) y jurisprudencia (Tipo:, TEMA:).
 * Devuelve { area?, type? } para metadata.
 */
function parseHeaderMetadata(raw) {
  const sepEquals = raw.indexOf('========================================')
  const sepDash = raw.search(/\n---\s*\n/)
  const end = sepEquals >= 0
    ? sepEquals
    : (sepDash >= 0 ? sepDash : Math.min(2000, raw.length))
  const block = raw.slice(0, end)
  const out = {}
  for (const line of block.split(/\r?\n/)) {
    const m = line.match(/^([^:]+):\s*(.*)$/)
    if (!m) continue
    const key = m[1].trim().toLowerCase().replace(/\s+/g, '_')
    const val = m[2].trim()
    if (key === 'tema') {
      out.tema = val
    } else if (key === 'tipo') {
      out.tipo = val
    }
  }
  if (out.tema) {
    const t = (out.tema || '').toLowerCase()
    if (/\b(tutela|derechos fundamentales|constitucional|libertad)\b/.test(t)) out.area = 'constitucional'
    else if (/\b(laboral|trabajo|empleo|prestaciones|cesantías)\b/.test(t)) out.area = 'laboral'
    else if (/\b(tributario|impuesto|iva|renta)\b/.test(t)) out.area = 'tributario'
    else if (/\b(penal|delito)\b/.test(t)) out.area = 'penal'
    else if (/\b(civil|contrato|familia|sucesión)\b/.test(t)) out.area = 'civil'
    else if (/\b(comercial|sociedad|empresa)\b/.test(t)) out.area = 'comercial'
    else if (/\b(administrativo|licencias|permisos|petición)\b/.test(t)) out.area = 'administrativo'
    else out.area = detectLegalAreaFromContent(out.tema, '')
  }
  if (out.tipo) {
    const tip = (out.tipo || '').toLowerCase()
    if (/\b(tutela|constitucionalidad|unificaci[oó]n)\b/.test(tip)) out.type = 'jurisprudencia'
    else if (/\b(decreto)\b/.test(tip)) out.type = 'estatuto'
    else if (/\b(ley|código)\b/.test(tip)) out.type = 'estatuto'
  }
  return { area: out.area, type: out.type }
}

function detectLegalAreaFromContent(title, content) {
  const text = (title + ' ' + content.substring(0, 2000)).toLowerCase()
  
  // Laboral
  if (text.match(/\b(trabajo|empleado|empleador|contrato laboral|prestaciones|cesant[ií]as|vacaciones|despido|horas extras|jornada|salario|código sustantivo del trabajo)\b/)) {
    return 'laboral'
  }
  
  // Comercial
  if (text.match(/\b(comercio|sociedad|empresa|contrato comercial|compraventa|arrendamiento comercial|código de comercio)\b/)) {
    return 'comercial'
  }
  
  // Civil
  if (text.match(/\b(contrato civil|propiedad|sucesi[oó]n|divorcio|patrimonio|obligaciones|código civil)\b/)) {
    return 'civil'
  }
  
  // Penal
  if (text.match(/\b(delito|pena|c[oó]digo penal|crimen|homicidio|robo|fraude)\b/)) {
    return 'penal'
  }
  
  // Administrativo
  if (text.match(/\b(acto administrativo|recurso|tutela|cumplimiento|entidad p[uú]blica|licencia|derecho de petición|código procedimiento administrativo)\b/)) {
    return 'administrativo'
  }
  
  // Tributario
  if (text.match(/\b(impuesto|renta|iva|dian|declaraci[oó]n tributaria|retenci[oó]n|estatuto tributario)\b/)) {
    return 'tributario'
  }
  
  // Constitucional
  if (text.match(/\b(constituci[oó]n|derechos fundamentales|acci[oó]n de tutela|corte constitucional)\b/)) {
    return 'constitucional'
  }
  
  return 'general'
}

/**
 * Divide un texto en segmentos de máximo maxSize caracteres, con overlap de overlap chars.
 * Respeta líneas; usa las últimas líneas como solapamiento entre segmentos.
 */
function splitTextBySize(text, maxSize = 1000, overlap = 150) {
  if (!text || text.length <= maxSize) return [text]
  const lines = text.split('\n')
  const segments = []
  let current = ''
  let currentLength = 0
  let overlapBuffer = []
  for (const line of lines) {
    const lineLength = line.length + 1 // +1 newline
    if (currentLength + lineLength > maxSize && current.length > 0) {
      if (overlapBuffer.length > 0) current += '\n' + overlapBuffer.join('\n')
      segments.push(current)
      const overlapText = overlapBuffer.join('\n')
      current = overlapText + (overlapText ? '\n' : '') + line
      currentLength = current.length
      overlapBuffer = []
    } else {
      current += (current ? '\n' : '') + line
      currentLength += line.length + 1
      overlapBuffer.push(line)
      if (overlapBuffer.length > 10) overlapBuffer.shift()
    }
  }
  if (current.length > 0) segments.push(current)
  return segments
}

function detectEntityFromFilename(name) {
  const lower = name.toLowerCase()
  
  // Detectar entidad emisora desde el nombre del archivo
  if (lower.includes('constitucion') || lower.includes('corte_constitucional')) {
    return 'Corte Constitucional'
  }
  if (lower.includes('codigo')) {
    return 'Congreso de la República'
  }
  if (lower.includes('ley_')) {
    return 'Congreso de la República'
  }
  if (lower.includes('decreto')) {
    return 'Presidencia de la República'
  }
  if (lower.includes('resolucion')) {
    return 'Entidad administrativa'
  }
  
  return 'Congreso de la República' // Default
}

function extractVigenciaFromFilename(name) {
  // Intentar extraer año del nombre del archivo (ej: ley_100_1993, codigo_599_2000)
  const yearMatch = name.match(/_(\d{4})/)
  if (yearMatch) {
    return yearMatch[1] + '-01-01' // Aproximación: año-01-01
  }
  return undefined
}

function extractTitle(content, fallback) {
  const lines = content.split(/\r?\n/)
  for (const l of lines.slice(0, 5)) {
    const m1 = l.match(/^#\s*(.+)$/i)
    if (m1) return m1[1].trim()
    const m2 = l.match(/^t[íi]tulo\s*:\s*(.+)$/i)
    if (m2) return m2[1].trim()
  }
  return fallback.replace(/[_-]/g, ' ')
}

/**
 * Elimina el header de metadata y el TOC de navegación HTML del contenido raw.
 * Soporta dos formatos:
 *   - YAML entre --- o cabecera con "Clave: valor" y separador ========
 *   - Tras el separador, opcional TOC; el cuerpo real empieza con TÍTULO/ARTÍCULO/DECRETO/etc.
 */
function stripHeaderAndNav(raw) {
  let content = raw
  const sepDash = raw.search(/\n---\s*\n/)
  const sepEquals = raw.indexOf('========================================')

  if (sepEquals >= 0) {
    // Separador ======== (decretos, jurisprudencia): quitar todo hasta después de esa línea
    const afterEquals = raw.indexOf('\n', sepEquals) + 1
    content = afterEquals > 0 ? raw.slice(afterEquals) : raw.slice(sepEquals + 40)
  } else if (sepDash >= 0) {
    content = raw.slice(sepDash + 5)
  }

  // Eliminar TOC de navegación HTML si existe (Inicio + números de artículos)
  const realContentMatch = content.search(
    /\n(T[ÍI]TULO|TITULO|CAP[ÍI]TULO|CAPITULO|ARTICULO\s+\d|ART[ÍI]CULO\s+\d|LEY\s+\d|DECRETO|C[OÓ]DIGO|CONSTITUCI[OÓ]N|NORMA|RESOLUCI[OÓ]N|SENTENCIA)/i
  )
  if (realContentMatch > 0) {
    content = content.slice(realContentMatch + 1)
  }

  return content
}

function splitByArticles(content) {
  const parts = []
  const lines = content.split(/\r?\n/)
  let buffer = []
  let currentArticle
  let currentTitle
  let currentChapter
  let currentSection
  
  const pushBuffer = () => {
    if (buffer.length === 0) return
    const articleText = buffer.join('\n').trim()
    if (articleText.length < 50) return // Ignorar buffers muy pequeños
    
    parts.push({ 
      text: articleText, 
      article: currentArticle,
      title: currentTitle,
      chapter: currentChapter,
      section: currentSection
    })
    buffer = []
  }
  
  for (const line of lines) {
    // Detectar Títulos (TÍTULO, TITULO, Título)
    const titleMatch = line.match(/^(T[íi]tulo|T[ÍI]TULO)\s+([IVX]+|PRIMERO|SEGUNDO|TERCERO|CUARTO|QUINTO|SEXTO|SÉPTIMO|OCTAVO|NOVENO|DÉCIMO)/i)
    if (titleMatch) {
      pushBuffer()
      currentTitle = `Título ${titleMatch[2]}`
      currentChapter = null
      currentSection = null
      buffer.push(line)
      continue
    }
    
    // Detectar Capítulos (CAPÍTULO, Capitulo, Capítulo)
    const chapterMatch = line.match(/^(Cap[íi]tulo|CAP[ÍI]TULO)\s+([IVX]+|[0-9]+)/i)
    if (chapterMatch) {
      pushBuffer()
      currentChapter = `Capítulo ${chapterMatch[2]}`
      currentSection = null
      buffer.push(line)
      continue
    }
    
    // Detectar Secciones (SECCIÓN, Seccion, Sección)
    const sectionMatch = line.match(/^(Secci[oó]n|SECCI[OÓ]N)\s+([IVX]+|[0-9]+)/i)
    if (sectionMatch) {
      pushBuffer()
      currentSection = `Sección ${sectionMatch[2]}`
      buffer.push(line)
      continue
    }
    
    // Detectar Artículos con múltiples formatos
    // Formato 1: "Artículo X" o "ARTÍCULO X"
    // Formato 2: "Art. X" o "Art X"
    // Formato 3: "Artículo X.-" (con guion)
    const artMatch = line.match(/^(Art[íi]culo|ART[ÍI]CULO|Art\.?)\s+([0-9A-Za-z\.\-]+)/i)
    if (artMatch) {
      pushBuffer()
      currentArticle = `Artículo ${artMatch[2]}`
      buffer.push(line)
      continue
    }
    
    // Detectar numerales (1., 2., a), b), etc.)
    const numeralMatch = line.match(/^(\d+[\.\)]|[a-z][\.\)])\s+/)
    if (numeralMatch && currentArticle) {
      // Es un numeral dentro de un artículo, agregar al buffer
      buffer.push(line)
      continue
    }
    
    buffer.push(line)
  }
  pushBuffer()
  
  // Función para dividir chunks muy grandes con overlap
  function splitLargeChunk(chunk, maxSize = 1000, overlap = 150) {
    if (chunk.text.length <= maxSize) {
      return [chunk]
    }
    
    const splits = []
    const lines = chunk.text.split('\n')
    let currentSplit = { ...chunk, text: '' }
    let currentLength = 0
    let overlapBuffer = []
    
    for (const line of lines) {
      const lineLength = line.length + 1 // +1 for newline
      
      if (currentLength + lineLength > maxSize && currentSplit.text.length > 0) {
        // Guardar el split actual con overlap
        if (overlapBuffer.length > 0) {
          currentSplit.text += '\n' + overlapBuffer.join('\n')
        }
        splits.push(currentSplit)
        
        // Crear nuevo split con overlap del anterior
        const overlapText = overlapBuffer.join('\n')
        currentSplit = {
          ...chunk,
          text: overlapText + (overlapText ? '\n' : '') + line
        }
        currentLength = currentSplit.text.length
        overlapBuffer = []
      } else {
        currentSplit.text += (currentSplit.text ? '\n' : '') + line
        currentLength += lineLength
        
        // Mantener últimas líneas para overlap
        overlapBuffer.push(line)
        if (overlapBuffer.length > 10) { // Mantener ~10 líneas para overlap
          overlapBuffer.shift()
        }
      }
    }
    
    // Agregar el último split
    if (currentSplit.text.length > 0) {
      splits.push(currentSplit)
    }
    
    return splits.length > 0 ? splits : [chunk]
  }
  
  // Mejorar la fusión de partes pequeñas
  const merged = []
  let acc = null
  
  for (const p of parts) {
    if (!acc) { 
      acc = { ...p }
      continue
    }
    
    // Si ambas partes son del mismo artículo o muy pequeñas, fusionar
    const sameArticle = acc.article === p.article
    const totalLength = acc.text.length + p.text.length
    
    if (sameArticle && totalLength < 1500) {
      // Fusionar partes del mismo artículo si no exceden el límite
      acc.text += '\n\n' + p.text
    } else if (!sameArticle && totalLength < 800 && acc.text.length < 400) {
      // Fusionar partes pequeñas de diferentes artículos si ambas son muy pequeñas
      acc.text += '\n\n' + p.text
      acc.article = acc.article ? `${acc.article} y ${p.article}` : p.article
    } else {
      // Dividir chunk grande antes de guardarlo (max 1000 chars, overlap 150)
      if (acc.text.length > 1000) {
        const splits = splitLargeChunk(acc, 1000, 150)
        merged.push(...splits)
      } else {
        merged.push(acc)
      }
      acc = { ...p }
    }
  }
  
  // Procesar el último acumulador
  if (acc) {
    if (acc.text.length > 1000) {
      const splits = splitLargeChunk(acc, 1000, 150)
      merged.push(...splits)
    } else {
      merged.push(acc)
    }
  }
  
  return merged
}

function stringHash(str) {
  let hash = 2166136261
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)
  }
  return hash >>> 0
}

function seededRandom(seed) {
  let s = seed >>> 0
  return () => {
    s = (1664525 * s + 1013904223) >>> 0
    return s / 0xffffffff
  }
}

function fakeEmbed(text, dim = 768) {
  const rand = seededRandom(stringHash(text))
  const v = Array.from({ length: dim }, () => rand() * 2 - 1)
  const norm = Math.sqrt(v.reduce((acc, x) => acc + x * x, 0)) || 1
  return v.map(x => x / norm)
}

async function embedBatch(texts) {
  const provider = process.env.EMB_PROVIDER || 'hf'
  if (provider === 'local') {
    console.warn('⚠️  Usando embeddings locales (fake). Para embeddings reales, configure HUGGINGFACE_API_KEY y EMB_PROVIDER=hf')
    return texts.map(t => fakeEmbed(t))
  }
  if (provider === 'xenova') {
    try {
      const { pipeline } = await import('@xenova/transformers')
      const model = process.env.EMB_MODEL || 'Xenova/paraphrase-multilingual-MiniLM-L12-v2'
      const extractor = await pipeline('feature-extraction', model)
      const outputs = await extractor(texts, { pooling: 'mean', normalize: true })
      // Tensor batch: shape [n, dim] — split correctly
      if (outputs?.dims?.length === 2) {
        const [n, dim] = outputs.dims
        const flat = Array.from(outputs.data)
        return Array.from({ length: n }, (_, i) => flat.slice(i * dim, (i + 1) * dim))
      }
      // Single text fallback
      return [Array.from(outputs.data || outputs)]
    } catch (e) {
      console.error('⚠️  Error con Xenova, usando embeddings locales:', e.message)
      return texts.map(t => fakeEmbed(t))
    }
  }
  // Default: Hugging Face - requiere API key
  if (!process.env.HUGGINGFACE_API_KEY) {
    console.error('❌ HUGGINGFACE_API_KEY no configurada. Configure la variable de entorno para usar embeddings reales.')
    console.error('   Usando embeddings locales (fake) como fallback.')
    return texts.map(t => fakeEmbed(t))
  }
  const { HfInference } = await import('@huggingface/inference')
  const model = process.env.HF_EMBEDDING_MODEL || 'sentence-transformers/paraphrase-multilingual-mpnet-base-v2'
  const hf = new HfInference(process.env.HUGGINGFACE_API_KEY, {
    endpoint: 'https://router.huggingface.co'
  })
  const maxRetries = 3
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const out = await hf.featureExtraction({ model, inputs: texts })
      return out
    } catch (err) {
      const is5xx = err?.httpResponse?.status >= 500 || err?.message?.includes('500')
      if (is5xx && attempt < maxRetries) {
        const delay = attempt * 8000
        console.warn(`\n⚠️  HF API error (intento ${attempt}/${maxRetries}), reintento en ${delay / 1000}s...`)
        await new Promise(r => setTimeout(r, delay))
      } else {
        throw err
      }
    }
  }
}

async function upsertPinecone(chunks) {
  const { Pinecone } = await import('@pinecone-database/pinecone')
  const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY })
  const index = pc.index(process.env.PINECONE_INDEX)
  const upsertBatch = 50
  for (let i = 0; i < chunks.length; i += upsertBatch) {
    const batch = chunks.slice(i, i + upsertBatch)
    await index.upsert(batch.map(b => ({
      id: b.id,
      values: b.embedding,
      metadata: {
        content: b.content,
        doc_id: b.metadata.id,
        title: b.metadata.title,
        type: b.metadata.type,
        article: b.metadata.article,
        url: b.metadata.url,
        sourcePath: b.metadata.sourcePath,
      }
    })))
    process.stdout.write('+')
  }
  process.stdout.write('\n')
  console.log(`Upsert completado en Pinecone: ${chunks.length} vectores`)
}

async function main() {
  // Validar configuración de embeddings
  const provider = process.env.EMB_PROVIDER || 'hf'
  if (provider === 'hf' && !process.env.HUGGINGFACE_API_KEY) {
    console.error('❌ Error: EMB_PROVIDER=hf requiere HUGGINGFACE_API_KEY')
    console.error('   Configure HUGGINGFACE_API_KEY en .env.local o use EMB_PROVIDER=local para desarrollo')
    process.exit(1)
  }

  if (!fs.existsSync(DOCS_DIR)) {
    console.error('Directorio no encontrado:', DOCS_DIR)
    process.exit(1)
  }
  const entries = await fsp.readdir(DOCS_DIR)
  let files = entries.filter(e => e.toLowerCase().endsWith('.txt')).sort()
  const maxDocs = process.env.INGEST_MAX_DOCS ? parseInt(process.env.INGEST_MAX_DOCS, 10) : null
  if (maxDocs != null && maxDocs > 0 && files.length > maxDocs) {
    files = files.slice(0, maxDocs)
    console.log(`⚠️  INGEST_MAX_DOCS=${process.env.INGEST_MAX_DOCS}: solo se procesarán ${files.length} documento(s) (build rápido en Vercel)`)
  }
  if (files.length === 0) {
    console.error('No se encontraron documentos en', DOCS_DIR)
    process.exit(1)
  }
  
  console.log(`📚 Procesando ${files.length} documento(s) con provider=${provider}`)

  const chunks = []

  for (const file of files) {
    const full = path.join(DOCS_DIR, file)
    const raw = await fsp.readFile(full, 'utf-8')
    const frontmatter = parseFrontmatter(raw)
    const headerMeta = parseHeaderMetadata(raw)
    const title = extractTitle(raw, path.parse(file).name)
    const typeFromFilename = guessTypeFromFilename(file)
    const type = frontmatter.tipo || headerMeta.type || typeFromFilename

    // Limpiar contenido antes de chunking (--- o ======== + TOC)
    const cleanContent = stripHeaderAndNav(raw)
    const articleChunks = splitByArticles(cleanContent)
    for (const part of articleChunks) {
      // Construir jerarquía completa para mejor citación
      const articleHierarchy = []
      if (part.title) articleHierarchy.push(part.title)
      if (part.chapter) articleHierarchy.push(part.chapter)
      if (part.section) articleHierarchy.push(part.section)
      if (part.article) articleHierarchy.push(part.article)
      
      // Área: frontmatter > cabecera alternativa (Tema:/Tipo:) > detección por contenido
      const areaDetected = detectLegalAreaFromContent(title, part.text)
      const area = frontmatter.area || headerMeta.area || areaDetected || 'general'
      const entidadEmisora = detectEntityFromFilename(file)
      const fechaVigencia = extractVigenciaFromFilename(file)
      
      const metadata = {
        id: `doc-${path.parse(file).name}`,
        title,
        type,
        article: part.article,
        articleHierarchy: articleHierarchy.length > 0 ? articleHierarchy.join(' > ') : undefined,
        chapter: part.chapter,
        section: part.section,
        area, // Para filtros en retrieval (antes areaLegal; frontmatter + detección)
        entidadEmisora,
        fechaVigencia,
        url: undefined,
        sourcePath: `data/documents/${file}`
      }
      // Asegurar que ningún chunk supere 1000 caracteres (split con overlap 150)
      const contentParts = part.text.length > 1000 ? splitTextBySize(part.text, 1000, 150) : [part.text]
      for (const content of contentParts) {
        chunks.push({ id: randomUUID(), content, metadata })
      }
    }
  }

  console.log(`Chunking listo: ${chunks.length} fragmentos`)
  console.log(`Generando embeddings en lotes de 16...`)

  const batchSize = 16
  const totalBatches = Math.ceil(chunks.length / batchSize)

  if (process.env.PINECONE_API_KEY && process.env.PINECONE_INDEX) {
    // Modo Pinecone: acumular en memoria y hacer upsert al final
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize)
      const batchNum = Math.floor(i / batchSize) + 1
      process.stdout.write(`\r[${batchNum}/${totalBatches}] Generando embeddings...`)
      const vectors = await embedBatch(batch.map(b => b.content))
      vectors.forEach((v, j) => { batch[j].embedding = Array.isArray(v) ? v : Array.from(v) })
    }
    process.stdout.write('\n✅ Embeddings generados\n')
    await upsertPinecone(chunks)
  } else {
    // Modo local: escribir al disco batch a batch para no acumular en RAM
    // Usamos archivo temporal + rename atómico al final
    const TMP_PATH = OUT_PATH + '.tmp'
    if (!fs.existsSync(path.dirname(OUT_PATH))) fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true })

    const stream = createWriteStream(TMP_PATH, { encoding: 'utf-8' })
    const writeToStream = (data) => new Promise((resolve, reject) => {
      const ok = stream.write(data)
      if (ok) return resolve()
      stream.once('drain', resolve)
      stream.once('error', reject)
    })

    await writeToStream('[\n')

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize)
      const batchNum = Math.floor(i / batchSize) + 1
      process.stdout.write(`\r[${batchNum}/${totalBatches}] Generando embeddings...`)
      const vectors = await embedBatch(batch.map(b => b.content))
      // Convertir a array plano por si el SDK retorna TypedArray (Float32Array)
      vectors.forEach((v, j) => { batch[j].embedding = Array.isArray(v) ? v : Array.from(v) })

      // Escribir batch al disco inmediatamente (libera memoria)
      for (let j = 0; j < batch.length; j++) {
        const globalIdx = i + j
        const isLast = globalIdx === chunks.length - 1
        await writeToStream(JSON.stringify(batch[j]) + (isLast ? '\n' : ',\n'))
        // Liberar embedding de memoria tras escribir
        batch[j].embedding = null
      }
    }

    await writeToStream(']\n')
    await new Promise((resolve, reject) => stream.end(err => err ? reject(err) : resolve()))

    // Rename atómico: el index.json real nunca queda corrupto
    await fsp.rename(TMP_PATH, OUT_PATH)
    process.stdout.write('\n✅ Embeddings generados\n')
    console.log('Índice local guardado en', OUT_PATH)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
}) 