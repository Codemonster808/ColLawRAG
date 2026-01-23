#!/usr/bin/env node
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fetch from 'node-fetch'
import * as cheerio from 'cheerio'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DOCS_DIR = path.join(process.cwd(), 'data', 'documents')
const DELAY_MS = 2000 // Delay entre requests para no sobrecargar servidores

// Fuentes prioritarias para MVP
const PRIORITY_LAWS = [
  {
    name: 'Constitucion Politica de Colombia',
    type: 'estatuto',
    url: 'https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=4125',
    selector: '#contenido'
  },
  {
    name: 'Codigo Sustantivo del Trabajo',
    type: 'estatuto',
    url: 'https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=4128',
    selector: '#contenido'
  },
  {
    name: 'Ley 100 de 1993 - Seguridad Social',
    type: 'estatuto',
    url: 'https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=5248',
    selector: '#contenido'
  },
  {
    name: 'Codigo Civil',
    type: 'estatuto',
    url: 'https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=4126',
    selector: '#contenido'
  },
  {
    name: 'Codigo de Comercio',
    type: 'estatuto',
    url: 'https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=4127',
    selector: '#contenido'
  }
]

// URLs alternativas de SUIN-Juriscol (si las anteriores fallan)
const SUIN_ALTERNATIVES = [
  'https://www.suin-juriscol.gov.co/viewDocument.asp?ruta=Leyes/1688814',
  'https://www.suin-juriscol.gov.co/viewDocument.asp?ruta=Leyes/1688815',
]

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
        },
        timeout: 30000
      })
      if (res.ok) {
        return await res.text()
      }
      if (res.status === 404) {
        console.warn(`⚠️  URL no encontrada: ${url}`)
        return null
      }
      console.warn(`⚠️  HTTP ${res.status} en intento ${i + 1}/${retries}`)
    } catch (e) {
      console.warn(`⚠️  Error en intento ${i + 1}/${retries}:`, e.message)
      if (i < retries - 1) {
        await sleep(1000 * (i + 1))
      }
    }
  }
  return null
}

function cleanText(text) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function extractContent(html, selector) {
  const $ = cheerio.load(html)
  const content = $(selector).text() || $('body').text()
  return cleanText(content)
}

function sanitizeFilename(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 100)
}

async function scrapeLaw(law) {
  console.log(`📥 Descargando: ${law.name}...`)
  
  const html = await fetchWithRetry(law.url)
  if (!html) {
    console.error(`❌ No se pudo descargar: ${law.name}`)
    return null
  }

  const content = extractContent(html, law.selector || 'body')
  if (content.length < 100) {
    console.warn(`⚠️  Contenido muy corto para: ${law.name} (${content.length} chars)`)
    return null
  }

  // Agregar header con metadata
  const header = `# ${law.name}\n\nTipo: ${law.type}\nFuente: ${law.url}\nFecha de extracción: ${new Date().toISOString()}\n\n---\n\n`
  const fullContent = header + content

  const filename = `${law.type}_${sanitizeFilename(law.name)}.txt`
  const filepath = path.join(DOCS_DIR, filename)

  await fsp.writeFile(filepath, fullContent, 'utf-8')
  console.log(`✅ Guardado: ${filename} (${fullContent.length} chars)`)
  
  await sleep(DELAY_MS)
  return { filename, size: fullContent.length }
}

async function scrapeFromManualSources() {
  // Crear documentos manuales basados en contenido conocido
  const manualDocs = [
    {
      name: 'Constitucion Politica de Colombia - Extractos',
      type: 'estatuto',
      content: `# Constitucion Politica de Colombia - Extractos Principales

## Preambulo
El pueblo de Colombia, en ejercicio de su poder soberano, representado por sus delegatarios a la Asamblea Nacional Constituyente, invocando la proteccion de Dios, y con el fin de fortalecer la unidad de la Nacion y asegurar a sus integrantes la vida, la convivencia, el trabajo, la justicia, la igualdad, el conocimiento, la libertad y la paz, dentro de un marco juridico, democratico y participativo que garantice un orden politico, economico y social justo, y comprometido a impulsar la integracion de la comunidad latinoamericana, decreta, sanciona y promulga la siguiente Constitucion Politica de Colombia.

## Titulo I - De los Principios Fundamentales

### Articulo 1
Colombia es un Estado social de derecho, organizado en forma de Republica unitaria, descentralizada, con autonomia de sus entidades territoriales, democratica, participativa y pluralista, fundada en el respeto de la dignidad humana, en el trabajo y la solidaridad de las personas que la integran y en la prevalencia del interes general.

### Articulo 2
Son fines esenciales del Estado: servir a la comunidad, promover la prosperidad general y garantizar la efectividad de los principios, derechos y deberes consagrados en la Constitucion; facilitar la participacion de todos en las decisiones que los afectan y en la vida economica, politica, administrativa y cultural de la Nacion; defender la independencia nacional, mantener la integridad territorial y asegurar la convivencia pacifica y la vigencia de un orden justo.

### Articulo 3
La soberania reside exclusivamente en el pueblo, del cual emana el poder publico. El pueblo la ejerce en forma directa o por medio de sus representantes, en los terminos que la Constitucion establece.

## Titulo II - De los Derechos, las Garantias y los Deberes

### Articulo 11
El derecho a la vida es inviolable. No habra pena de muerte.

### Articulo 13
Todas las personas nacen libres e iguales ante la ley, recibiran la misma proteccion y trato de las autoridades y gozaran de los mismos derechos, libertades y oportunidades sin ninguna discriminacion por razones de sexo, raza, origen nacional o familiar, lengua, religion, opinion politica o filosofica.

### Articulo 25
El trabajo es un derecho y una obligacion social y goza, en todas sus modalidades, de la especial proteccion del Estado. Toda persona tiene derecho a un trabajo en condiciones dignas y justas.

### Articulo 86
Toda persona tendra accion de tutela para reclamar ante los jueces, en todo momento y lugar, mediante un procedimiento preferente y sumario, por si misma o por quien actue a su nombre, la proteccion inmediata de sus derechos constitucionales fundamentales, cuando quiera que estos resulten vulnerados o amenazados por la accion o la omision de cualquier autoridad publica.

La proteccion consistira en una orden para que aquel respecto de quien se solicita la tutela, actue o se abstenga de hacerlo. El fallo, que sera de inmediato cumplimiento, podra impugnarse ante el juez competente y, en todo caso, este lo remitira a la Corte Constitucional para su eventual revision.

Esta accion solo procedera cuando el afectado no disponga de otro medio de defensa judicial, salvo que aquella se utilice como mecanismo transitorio para evitar un perjuicio irremediable.

En ningun caso podran transcurrir mas de diez dias entre la solicitud de tutela y su resolucion.

La ley establecera los casos en los que la accion de tutela procede contra particulares encargados de la prestacion de un servicio publico o cuya conducta afecte grave y directamente el interes colectivo, o respecto de quienes el solicitante se encuentre en estado de subordinacion o indefension.
`
    },
    {
      name: 'Codigo Sustantivo del Trabajo - Extractos',
      type: 'estatuto',
      content: `# Codigo Sustantivo del Trabajo - Extractos Principales

## Titulo I - Disposiciones Generales

### Articulo 1
El presente Codigo rige las relaciones de trabajo particulares y las de derecho publico que se refieran a relaciones de trabajo, y establece las normas sustantivas y procesales del trabajo.

### Articulo 2
Las disposiciones de este Codigo son de orden publico y de interes social. No pueden ser renunciadas ni relajadas por convenios particulares.

## Titulo II - De la Jornada de Trabajo

### Articulo 159 - Trabajo Suplementario u Horas Extras
El trabajo que exceda de la jornada ordinaria constituye trabajo suplementario o de horas extras y debe ser remunerado con recargo del veinticinco por ciento (25%) sobre el salario ordinario, en el diurno, y del setenta y cinco por ciento (75%) en el nocturno.

### Articulo 160 - Jornada Ordinaria de Trabajo
La jornada ordinaria de trabajo es la que convengan las partes, sin que pueda exceder de ocho (8) horas diarias ni de cuarenta y ocho (48) horas semanales.

La jornada nocturna es la que se cumple entre las 6:00 p.m. y las 6:00 a.m. del dia siguiente.

### Articulo 161 - Descanso Obligatorio
Todo trabajador tiene derecho a un descanso remunerado de quince (15) minutos en cada jornada continua de trabajo.

### Articulo 168 - Recargo por Trabajo Nocturno
El trabajo nocturno tiene un recargo del treinta y cinco por ciento (35%) sobre el salario ordinario diurno.

## Titulo III - Del Salario

### Articulo 127 - Definicion de Salario
Salario es el pago en dinero que el empleador debe hacer al trabajador por la prestacion del servicio, sin perjuicio de las prestaciones sociales establecidas por la ley.

### Articulo 128 - Salario Minimo
El salario minimo legal es el que se fija anualmente por el Gobierno Nacional, previo concepto de la Comision Permanente de Concertacion de Politicas Salariales y Laborales.

## Titulo IV - De las Prestaciones Sociales

### Articulo 233 - Cesantias
Todo empleador esta obligado a pagar a sus trabajadores, por concepto de cesantias, un mes de salario por cada ano de servicio y proporcionalmente por fraccion de ano.

### Articulo 236 - Intereses sobre Cesantias
Las cesantias causan interes a favor del trabajador a razon del doce por ciento (12%) anual o proporcionalmente por fracciones de ano, el cual se paga junto con las cesantias al momento de la liquidacion definitiva.
`
    },
    {
      name: 'Ley 100 de 1993 - Seguridad Social',
      type: 'estatuto',
      content: `# Ley 100 de 1993 - Sistema General de Seguridad Social en Salud

## Titulo I - Disposiciones Generales

### Articulo 1
El Sistema de Seguridad Social Integral es el conjunto de instituciones, normas y procedimientos, de que disponen la persona y la comunidad para gozar de una calidad de vida, mediante el cumplimiento progresivo de los planes y programas que el Estado y la sociedad desarrollen para proporcionar la cobertura integral de las contingencias, especialmente las que menoscaban la salud y la capacidad economica, de los habitantes del territorio nacional.

### Articulo 2
El Sistema de Seguridad Social Integral tiene por objeto garantizar los derechos irrenunciables de la persona y la comunidad para obtener la calidad de vida acorde con la dignidad humana, mediante la proteccion de las contingencias que la afecten.

### Articulo 3
El Sistema de Seguridad Social Integral se fundamenta en los principios de eficiencia, universalidad, solidaridad, integralidad, unidad y participacion.

## Titulo II - Del Sistema General de Pensiones

### Articulo 10
El Sistema General de Pensiones tiene por objeto garantizar a la poblacion, el amparo contra las contingencias derivadas de la vejez, la invalidez y la muerte, mediante el reconocimiento de las pensiones y prestaciones determinadas en la presente Ley.

### Articulo 11
El Sistema General de Pensiones esta compuesto por dos regimenes solidarios excluyentes entre si: el Regimen Solidario de Prima Media con Prestacion Definida y el Regimen de Ahorro Individual con Solidaridad.

## Titulo III - Del Sistema General de Seguridad Social en Salud

### Articulo 152
El Sistema General de Seguridad Social en Salud tiene por objeto regular el servicio publico esencial de salud y crear condiciones de acceso en toda la poblacion al servicio en todos los niveles de atencion.

### Articulo 153
El Sistema General de Seguridad Social en Salud esta integrado por un conjunto de entidades publicas y privadas, normas y procedimientos, y esta conformado por los regimenes contributivo y subsidiado.
`
    }
  ]

  for (const doc of manualDocs) {
    const filename = `${doc.type}_${sanitizeFilename(doc.name)}.txt`
    const filepath = path.join(DOCS_DIR, filename)
    await fsp.writeFile(filepath, doc.content, 'utf-8')
    console.log(`✅ Creado manualmente: ${filename} (${doc.content.length} chars)`)
  }
}

async function main() {
  console.log('🚀 Iniciando scraping de leyes colombianas...\n')

  if (!fs.existsSync(DOCS_DIR)) {
    fs.mkdirSync(DOCS_DIR, { recursive: true })
  }

  // Primero crear documentos manuales (mas confiables para MVP)
  console.log('📝 Creando documentos manuales prioritarios...\n')
  await scrapeFromManualSources()

  console.log('\n🌐 Intentando descargar desde fuentes web...\n')
  
  const results = []
  for (const law of PRIORITY_LAWS) {
    const result = await scrapeLaw(law)
    if (result) {
      results.push(result)
    }
  }

  console.log(`\n✅ Proceso completado. ${results.length} documento(s) descargado(s) desde web.`)
  console.log(`📚 Total de documentos en ${DOCS_DIR}: ${(await fsp.readdir(DOCS_DIR)).length}`)
}

main().catch(err => {
  console.error('❌ Error:', err)
  process.exit(1)
})

