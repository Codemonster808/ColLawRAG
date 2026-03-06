#!/usr/bin/env node
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fetch from 'node-fetch'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Implementación inline del validador de citas
function extractCitationRefs(text) {
  const citationRegex = /\[(\d+)\]/g
  const matches = Array.from(text.matchAll(citationRegex))
  return [...new Set(matches.map(m => `[${m[1]}]`))].sort((a, b) => {
    const numA = parseInt(a.slice(1, -1))
    const numB = parseInt(b.slice(1, -1))
    return numA - numB
  })
}

function validateCitations(answer, chunks) {
  const citationRefs = extractCitationRefs(answer)
  
  if (citationRefs.length === 0) {
    return {
      totalCitations: 0,
      validCitations: 0,
      precision: 1.0,
      invalidCitations: [],
      validCitationsList: []
    }
  }

  const validations = citationRefs.map(ref => {
    const match = ref.match(/\[(\d+)\]/)
    if (!match) {
      return {
        citationRef: ref,
        isValid: false,
        sourceTitle: null,
        articleMatch: false,
        confidence: 0,
        errorMessage: 'Formato de cita inválido'
      }
    }

    const index = parseInt(match[1]) - 1

    if (index < 0 || index >= chunks.length) {
      return {
        citationRef: ref,
        isValid: false,
        sourceTitle: null,
        articleMatch: false,
        confidence: 0,
        expectedIndex: index,
        errorMessage: `Cita fuera de rango: ${ref} (hay ${chunks.length} fuentes disponibles)`
      }
    }

    const chunk = chunks[index].chunk
    return {
      citationRef: ref,
      isValid: true,
      sourceTitle: chunk.metadata.title,
      articleMatch: true,
      confidence: 1.0,
      expectedIndex: index,
      actualIndex: index
    }
  })

  const validCitations = validations.filter(v => v.isValid && v.articleMatch)
  const invalidCitations = validations.filter(v => !v.isValid || !v.articleMatch)

  return {
    totalCitations: citationRefs.length,
    validCitations: validCitations.length,
    precision: citationRefs.length > 0 ? validCitations.length / citationRefs.length : 0,
    invalidCitations,
    validCitationsList: validCitations
  }
}

const TEST_QUERIES_PATH = path.join(process.cwd(), 'data', 'eval', 'test-queries.json')
const REPORT_PATH = path.join(process.cwd(), 'data', 'eval', 'quality-report.json')
const REPORT_TXT_PATH = path.join(process.cwd(), 'data', 'eval', 'quality-report.txt')

async function loadTestQueries() {
  if (!fs.existsSync(TEST_QUERIES_PATH)) {
    console.error(`❌ No se encontró el archivo de consultas de prueba: ${TEST_QUERIES_PATH}`)
    process.exit(1)
  }
  const content = await fsp.readFile(TEST_QUERIES_PATH, 'utf-8')
  return JSON.parse(content)
}

async function evaluateQuery(queryData, index, total) {
  console.log(`\n[${index + 1}/${total}] Evaluando: "${queryData.question}"`)
  
  try {
    // Intentar usar el API local primero
    let result
    const apiUrl = process.env.RAG_API_URL || 'http://localhost:3000/api/rag'
    
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: queryData.question,
          locale: 'es'
        }),
        timeout: 30000
      })
      
      if (response.ok) {
        result = await response.json()
      } else {
        throw new Error(`API returned ${response.status}`)
      }
    } catch (apiError) {
      // Si el API no está disponible, usar tsx para ejecutar TypeScript
      console.warn('⚠️  API no disponible, usando tsx para ejecutar TypeScript...')
      const { execSync } = await import('child_process')
      
      // Crear un script temporal que ejecute el RAG
      const tempScriptContent = `
import { runRagPipeline } from '../lib/rag.ts'
const result = await runRagPipeline({ query: ${JSON.stringify(queryData.question)}, locale: 'es' })
console.log(JSON.stringify(result))
`
      const tempPath = path.join(process.cwd(), '.temp-eval.mjs')
      await fsp.writeFile(tempPath, tempScriptContent, 'utf-8')
      
      try {
        const output = execSync(`npx tsx ${tempPath}`, { 
          encoding: 'utf-8', 
          cwd: process.cwd(),
          env: { ...process.env, NODE_ENV: 'development' }
        })
        result = JSON.parse(output.trim())
        await fsp.unlink(tempPath).catch(() => {})
      } catch (e) {
        await fsp.unlink(tempPath).catch(() => {})
        throw new Error(`No se pudo ejecutar RAG: ${e.message}`)
      }
    }

    // Validar las citas en la respuesta
    // Cargar el índice completo para obtener el contenido real
    const indexPath = path.join(process.cwd(), 'data', 'index.json')
    if (fs.existsSync(indexPath)) {
      const indexContent = await fsp.readFile(indexPath, 'utf-8')
      const indexData = JSON.parse(indexContent)
      
      // Mapear citations a chunks completos
      const fullChunks = result.citations.map((cit, idx) => {
        const fullChunk = indexData.find(c => c.id === cit.id || c.metadata?.id === cit.id)
        if (fullChunk) {
          return {
            chunk: {
              id: fullChunk.id,
              content: fullChunk.content || '',
              metadata: fullChunk.metadata || {
                id: cit.id,
                title: cit.title,
                type: cit.type,
                article: cit.article,
                url: cit.url
              }
            },
            score: cit.score || 0
          }
        }
        // Fallback si no se encuentra
        return {
          chunk: {
            id: cit.id,
            content: '',
            metadata: {
              id: cit.id,
              title: cit.title,
              type: cit.type,
              article: cit.article,
              url: cit.url
            }
          },
          score: cit.score || 0
        }
      })

      const validation = validateCitations(result.answer, fullChunks)
      
      return {
        query: queryData.question,
        category: queryData.category,
        answer: result.answer,
        citations: result.citations,
        validation,
        expectedSources: queryData.expectedSources,
        expectedAnswerContains: queryData.expectedAnswerContains
      }
    } else {
      console.warn('⚠️  No se encontró data/index.json, usando validación básica')
      const chunks = result.citations.map((cit, idx) => ({
        chunk: {
          id: cit.id,
          content: '',
          metadata: {
            id: cit.id,
            title: cit.title,
            type: cit.type,
            article: cit.article,
            url: cit.url
          }
        },
        score: cit.score || 0
      }))
      const validation = validateCitations(result.answer, chunks)
      
      return {
        query: queryData.question,
        category: queryData.category,
        answer: result.answer,
        citations: result.citations,
        validation,
        expectedSources: queryData.expectedSources,
        expectedAnswerContains: queryData.expectedAnswerContains
      }
    }
  } catch (error) {
    console.error(`❌ Error evaluando consulta:`, error.message)
    return {
      query: queryData.question,
      category: queryData.category,
      error: error.message,
      validation: {
        totalCitations: 0,
        validCitations: 0,
        precision: 0,
        invalidCitations: [],
        validCitationsList: []
      }
    }
  }
}

async function generateReport(evaluationResults) {
  const totalQueries = evaluationResults.length
  const successfulQueries = evaluationResults.filter(r => !r.error).length
  const failedQueries = totalQueries - successfulQueries

  // Calcular métricas agregadas
  const allValidations = evaluationResults
    .filter(r => !r.error && r.validation)
    .map(r => r.validation)

  const totalCitations = allValidations.reduce((sum, v) => sum + v.totalCitations, 0)
  const totalValidCitations = allValidations.reduce((sum, v) => sum + v.validCitations, 0)
  const avgPrecision = allValidations.length > 0
    ? allValidations.reduce((sum, v) => sum + v.precision, 0) / allValidations.length
    : 0

  // Agrupar por categoría
  const byCategory = {}
  evaluationResults.forEach(result => {
    if (result.error) return
    const cat = result.category || 'sin_categoria'
    if (!byCategory[cat]) {
      byCategory[cat] = {
        total: 0,
        validCitations: 0,
        totalCitations: 0,
        precision: 0
      }
    }
    byCategory[cat].total++
    byCategory[cat].validCitations += result.validation.validCitations
    byCategory[cat].totalCitations += result.validation.totalCitations
  })

  // Calcular precisión por categoría
  Object.keys(byCategory).forEach(cat => {
    const catData = byCategory[cat]
    catData.precision = catData.totalCitations > 0
      ? catData.validCitations / catData.totalCitations
      : 0
  })

  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalQueries,
      successfulQueries,
      failedQueries,
      overallPrecision: avgPrecision,
      totalCitations,
      totalValidCitations,
      citationPrecision: totalCitations > 0 ? totalValidCitations / totalCitations : 0
    },
    byCategory,
    detailedResults: evaluationResults
  }

  // Guardar reporte JSON
  await fsp.mkdir(path.dirname(REPORT_PATH), { recursive: true })
  await fsp.writeFile(REPORT_PATH, JSON.stringify(report, null, 2), 'utf-8')

  // Generar reporte de texto legible
  const reportLines = []
  reportLines.push('='.repeat(60))
  reportLines.push('REPORTE DE EVALUACIÓN DE CALIDAD DE CITAS')
  reportLines.push('='.repeat(60))
  reportLines.push(`Fecha: ${new Date().toLocaleString('es-CO')}`)
  reportLines.push('')
  reportLines.push('RESUMEN GENERAL')
  reportLines.push('-'.repeat(60))
  reportLines.push(`Total de consultas: ${totalQueries}`)
  reportLines.push(`Consultas exitosas: ${successfulQueries}`)
  reportLines.push(`Consultas fallidas: ${failedQueries}`)
  reportLines.push(`Precisión promedio: ${(avgPrecision * 100).toFixed(1)}%`)
  reportLines.push(`Total de citas: ${totalCitations}`)
  reportLines.push(`Citas válidas: ${totalValidCitations}`)
  reportLines.push(`Precisión de citas: ${totalCitations > 0 ? ((totalValidCitations / totalCitations) * 100).toFixed(1) : 0}%`)
  reportLines.push('')

  if (Object.keys(byCategory).length > 0) {
    reportLines.push('POR CATEGORÍA')
    reportLines.push('-'.repeat(60))
    Object.entries(byCategory).forEach(([cat, data]) => {
      reportLines.push(`${cat}:`)
      reportLines.push(`  Consultas: ${data.total}`)
      reportLines.push(`  Citas válidas: ${data.validCitations}/${data.totalCitations}`)
      reportLines.push(`  Precisión: ${(data.precision * 100).toFixed(1)}%`)
      reportLines.push('')
    })
  }

  reportLines.push('RESULTADOS DETALLADOS')
  reportLines.push('-'.repeat(60))
  evaluationResults.forEach((result, idx) => {
    reportLines.push(`\n[${idx + 1}] ${result.query}`)
    reportLines.push(`Categoría: ${result.category || 'N/A'}`)
    if (result.error) {
      reportLines.push(`❌ Error: ${result.error}`)
    } else {
      reportLines.push(`Respuesta: ${result.answer.substring(0, 200)}...`)
      reportLines.push(`Citas encontradas: ${result.validation.totalCitations}`)
      reportLines.push(`Citas válidas: ${result.validation.validCitations}`)
      reportLines.push(`Precisión: ${(result.validation.precision * 100).toFixed(1)}%`)
      
      if (result.validation.invalidCitations.length > 0) {
        reportLines.push('Citas inválidas:')
        result.validation.invalidCitations.forEach(inv => {
          reportLines.push(`  - ${inv.citationRef}: ${inv.errorMessage || 'No válida'}`)
        })
      }
    }
  })

  await fsp.writeFile(REPORT_TXT_PATH, reportLines.join('\n'), 'utf-8')

  return report
}

async function main() {
  console.log('🚀 Iniciando evaluación de calidad de citas...\n')

  const testData = await loadTestQueries()
  const queries = testData.queries || []

  if (queries.length === 0) {
    console.error('❌ No se encontraron consultas de prueba')
    process.exit(1)
  }

  console.log(`📋 Cargadas ${queries.length} consultas de prueba\n`)

  const results = []
  for (let i = 0; i < queries.length; i++) {
    const result = await evaluateQuery(queries[i], i, queries.length)
    results.push(result)
    
    // Pequeño delay para no sobrecargar
    if (i < queries.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  console.log('\n📊 Generando reporte...')
  const report = await generateReport(results)

  console.log('\n✅ Evaluación completada!')
  console.log(`📄 Reporte JSON: ${REPORT_PATH}`)
  console.log(`📄 Reporte texto: ${REPORT_TXT_PATH}`)
  console.log(`\n📈 Resumen:`)
  console.log(`   Precisión promedio: ${(report.summary.overallPrecision * 100).toFixed(1)}%`)
  console.log(`   Citas válidas: ${report.summary.totalValidCitations}/${report.summary.totalCitations}`)
}

main().catch(err => {
  console.error('❌ Error:', err)
  process.exit(1)
})
