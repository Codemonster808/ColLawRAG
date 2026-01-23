import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DOCS_DIR = path.join(process.cwd(), 'data', 'documents')
const OUT_PATH = path.join(process.cwd(), 'data', 'index.json')

function guessTypeFromFilename(name) {
  if (name.toLowerCase().startsWith('estatuto_')) return 'estatuto'
  if (name.toLowerCase().startsWith('jurisprudencia_')) return 'jurisprudencia'
  if (name.toLowerCase().startsWith('reglamento_')) return 'reglamento'
  return 'estatuto'
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
      // Guardar el acumulador y empezar uno nuevo
      merged.push(acc)
      acc = { ...p }
    }
  }
  
  if (acc) merged.push(acc)
  
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
      const model = process.env.EMB_MODEL || 'Xenova/all-MiniLM-L6-v2'
      const extractor = await pipeline('feature-extraction', model)
      const outputs = await extractor(texts, { pooling: 'mean', normalize: true })
      const toArray = (x) => Array.from(x.data || x)
      return Array.isArray(outputs) ? outputs.map(toArray) : [toArray(outputs)]
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
  // Use the new router endpoint instead of the deprecated api-inference endpoint
  const hf = new HfInference(process.env.HUGGINGFACE_API_KEY, {
    endpoint: 'https://router.huggingface.co'
  })
  const out = await hf.featureExtraction({ model, inputs: texts })
  return out
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
  const files = entries.filter(e => e.toLowerCase().endsWith('.txt'))
  if (files.length === 0) {
    console.error('No se encontraron documentos en', DOCS_DIR)
    process.exit(1)
  }
  
  console.log(`📚 Procesando ${files.length} documento(s) con provider=${provider}`)

  const chunks = []

  for (const file of files) {
    const full = path.join(DOCS_DIR, file)
    const raw = await fsp.readFile(full, 'utf-8')
    const title = extractTitle(raw, path.parse(file).name)
    const type = guessTypeFromFilename(file)

    const articleChunks = splitByArticles(raw)
    for (const part of articleChunks) {
      const id = randomUUID()
      
      // Construir jerarquía completa para mejor citación
      const articleHierarchy = []
      if (part.title) articleHierarchy.push(part.title)
      if (part.chapter) articleHierarchy.push(part.chapter)
      if (part.section) articleHierarchy.push(part.section)
      if (part.article) articleHierarchy.push(part.article)
      
      const metadata = {
        id: `doc-${path.parse(file).name}`,
        title,
        type,
        article: part.article,
        articleHierarchy: articleHierarchy.length > 0 ? articleHierarchy.join(' > ') : undefined,
        chapter: part.chapter,
        section: part.section,
        url: undefined,
        sourcePath: `data/documents/${file}`
      }
      chunks.push({ id, content: part.text, metadata })
    }
  }

  console.log(`Chunking listo: ${chunks.length} fragmentos`)

  const batchSize = 16
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize)
    const vectors = await embedBatch(batch.map(b => b.content))
    vectors.forEach((v, j) => { batch[j].embedding = v })
    process.stdout.write('.')
  }
  process.stdout.write('\n')

  if (process.env.PINECONE_API_KEY && process.env.PINECONE_INDEX) {
    await upsertPinecone(chunks)
  } else {
    if (!fs.existsSync(path.dirname(OUT_PATH))) fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true })
    await fsp.writeFile(OUT_PATH, JSON.stringify(chunks, null, 2), 'utf-8')
    console.log('Índice local guardado en', OUT_PATH)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
}) 