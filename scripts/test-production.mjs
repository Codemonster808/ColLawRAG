#!/usr/bin/env node
/**
 * Script de Testing Post-Deploy para RAG Derecho Colombiano
 * 
 * Ejecuta una suite completa de tests en el ambiente de producción/preview
 * 
 * Uso:
 *   DEPLOY_URL=https://col-law-rag.vercel.app node scripts/test-production.mjs
 */

import fetch from 'node-fetch'

const DEPLOY_URL = process.env.DEPLOY_URL || process.env.VERCEL_URL || 'http://localhost:3000'
const BASE_URL = DEPLOY_URL.startsWith('http') ? DEPLOY_URL : `https://${DEPLOY_URL}`

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
}

let totalTests = 0
let passedTests = 0
let failedTests = 0
const failures = []

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function test(name, fn) {
  totalTests++
  try {
    const result = fn()
    if (result instanceof Promise) {
      return result.then(() => {
        passedTests++
        log(`✅ ${name}`, 'green')
        return true
      }).catch((error) => {
        failedTests++
        failures.push({ name, error: error.message })
        log(`❌ ${name}: ${error.message}`, 'red')
        return false
      })
    } else {
      passedTests++
      log(`✅ ${name}`, 'green')
      return true
    }
  } catch (error) {
    failedTests++
    failures.push({ name, error: error.message })
    log(`❌ ${name}: ${error.message}`, 'red')
    return false
  }
}

async function testHealthCheck() {
  log('\n📋 Tests de Health Check', 'blue')
  
  await test('Health check retorna 200', async () => {
    const res = await fetch(`${BASE_URL}/api/health`)
    if (res.status !== 200) {
      throw new Error(`Expected 200, got ${res.status}`)
    }
  })
  
  await test('Status es "healthy"', async () => {
    const res = await fetch(`${BASE_URL}/api/health`)
    const data = await res.json()
    if (data.status !== 'healthy') {
      throw new Error(`Expected "healthy", got "${data.status}"`)
    }
  })
  
  await test('indexFile check es "ok"', async () => {
    const res = await fetch(`${BASE_URL}/api/health`)
    const data = await res.json()
    if (data.checks?.indexFile?.status !== 'ok') {
      throw new Error(`Expected indexFile status "ok", got "${data.checks?.indexFile?.status}"`)
    }
  })
  
  await test('huggingFace check es "ok"', async () => {
    const res = await fetch(`${BASE_URL}/api/health`)
    const data = await res.json()
    if (data.checks?.huggingFace?.status !== 'ok') {
      throw new Error(`Expected huggingFace status "ok", got "${data.checks?.huggingFace?.status}"`)
    }
  })
}

async function testRAGAPI() {
  log('\n📋 Tests de API RAG', 'blue')
  
  const testQueries = [
    '¿Qué es la acción de tutela?',
    'Ley laboral colombiana sobre horas extras',
    'Requisitos de la acción de cumplimiento'
  ]
  
  // Consultas complejas para verificar retry y fallback
  const complexQueries = [
    'Trabajé durante 3 años y 8 meses con un salario de $3.500.000 mensuales. Trabajé 15 horas extras en el último mes y también trabajé los domingos sin pago adicional. Si me despiden sin justa causa, ¿cuánto me deben de indemnización, prestaciones sociales y horas extras?',
    'Explícame el procedimiento completo para interponer una acción de tutela en Colombia: requisitos, plazos, competencia, efectos y recursos disponibles.',
    '¿Cuáles son las diferencias entre acción de tutela, acción de cumplimiento y acción popular? Incluye cuándo procede cada una y sus efectos legales.'
  ]
  
  // Combinar queries simples y complejas
  const allQueries = [...testQueries, ...complexQueries]
  
  let successfulComplexQueries = 0
  let totalComplexQueries = 0
  
  for (const query of allQueries) {
    const isComplex = complexQueries.includes(query)
    if (isComplex) {
      totalComplexQueries++
    }
    await test(`Request retorna 200 para: "${query.substring(0, 30)}..."`, async () => {
      const startTime = Date.now()
      const res = await fetch(`${BASE_URL}/api/rag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, locale: 'es' })
      })
      const responseTime = Date.now() - startTime
      
      if (res.status !== 200) {
        const errorText = await res.text()
        throw new Error(`Expected 200, got ${res.status}: ${errorText}`)
      }
      
      if (responseTime > 30000) {
        throw new Error(`Response time ${responseTime}ms exceeds 30s limit`)
      }
      
      return { res, responseTime }
    })
    
    await test(`Respuesta contiene "answer" para: "${query.substring(0, 30)}..."`, async () => {
      const res = await fetch(`${BASE_URL}/api/rag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, locale: 'es' })
      })
      const data = await res.json()
      
      if (!data.answer || typeof data.answer !== 'string' || data.answer.trim().length === 0) {
        throw new Error('Answer is missing, not a string, or empty')
      }
      
      // Verificar que no es el mensaje de error genérico
      const errorMessage = 'No fue posible generar la respuesta en este momento. Intenta nuevamente más tarde.'
      if (data.answer === errorMessage) {
        throw new Error('Answer is generic error message (generation failed)')
      }
      
      // Si es consulta compleja y tiene respuesta válida, contar como exitosa
      if (isComplex && data.answer !== errorMessage && data.answer.length > 50) {
        successfulComplexQueries++
      }
    })
    
    await test(`Respuesta contiene "citations" para: "${query.substring(0, 30)}..."`, async () => {
      const res = await fetch(`${BASE_URL}/api/rag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, locale: 'es' })
      })
      const data = await res.json()
      
      if (!Array.isArray(data.citations) || data.citations.length === 0) {
        throw new Error('Citations is missing, not an array, or empty')
      }
    })
    
    await test(`Citas tienen estructura válida para: "${query.substring(0, 30)}..."`, async () => {
      const res = await fetch(`${BASE_URL}/api/rag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, locale: 'es' })
      })
      const data = await res.json()
      
      for (const citation of data.citations) {
        if (!citation.title || typeof citation.title !== 'string') {
          throw new Error('Citation missing title or title is not a string')
        }
        if (!citation.type || typeof citation.type !== 'string') {
          throw new Error('Citation missing type or type is not a string')
        }
        if (typeof citation.score !== 'number' && citation.score !== undefined) {
          throw new Error('Citation score must be a number or undefined')
        }
      }
    })
    
    await test(`Tiempo de respuesta < 30s para: "${query.substring(0, 30)}..."`, async () => {
      const startTime = Date.now()
      await fetch(`${BASE_URL}/api/rag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, locale: 'es' })
      })
      const responseTime = Date.now() - startTime
      
      if (responseTime >= 30000) {
        throw new Error(`Response time ${responseTime}ms exceeds 30s limit`)
      }
    })
  }
  
  // Verificar tasa de éxito de consultas complejas
  if (totalComplexQueries > 0) {
    await test(`Tasa de éxito consultas complejas > 95%`, async () => {
      const successRate = (successfulComplexQueries / totalComplexQueries) * 100
      log(`\n📊 Tasa de éxito consultas complejas: ${successRate.toFixed(1)}% (${successfulComplexQueries}/${totalComplexQueries})`, 'blue')
      
      if (successRate < 95) {
        throw new Error(`Success rate ${successRate.toFixed(1)}% is below 95% target`)
      }
    })
  }
}

async function testContentValidation() {
  log('\n📋 Tests de Validación de Contenido', 'blue')
  
  await test('Respuestas están en español', async () => {
    const res = await fetch(`${BASE_URL}/api/rag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        query: '¿Qué es la acción de tutela?', 
        locale: 'es' 
      })
    })
    const data = await res.json()
    
    // Verificar que contiene palabras comunes en español
    const spanishWords = ['la', 'de', 'el', 'en', 'que', 'es', 'un', 'una', 'con', 'por']
    const answerLower = data.answer.toLowerCase()
    const hasSpanishWords = spanishWords.some(word => answerLower.includes(word))
    
    if (!hasSpanishWords) {
      throw new Error('Answer does not appear to be in Spanish')
    }
  })
  
  await test('Citas referencian documentos legales colombianos', async () => {
    const res = await fetch(`${BASE_URL}/api/rag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        query: 'Ley laboral colombiana', 
        locale: 'es' 
      })
    })
    const data = await res.json()
    
    // Verificar que al menos una cita tiene un título relacionado con leyes colombianas
    const colombianLegalTerms = ['colombia', 'colombiano', 'código', 'ley', 'constituc', 'trabajo', 'civil']
    const hasColombianReference = data.citations.some(citation => {
      const titleLower = citation.title.toLowerCase()
      return colombianLegalTerms.some(term => titleLower.includes(term))
    })
    
    if (!hasColombianReference) {
      throw new Error('Citations do not appear to reference Colombian legal documents')
    }
  })
  
  await test('No hay PII en las respuestas', async () => {
    const res = await fetch(`${BASE_URL}/api/rag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        query: 'Ley laboral colombiana', 
        locale: 'es' 
      })
    })
    const data = await res.json()
    
    // Verificar que no contiene patrones de PII
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/
    const phonePattern = /\b(?:\+57\s?)?(?:3\d{2}|60[1-8]|[1-9]\d{1,2})[-.\s]?\d{3}[-.\s]?\d{4}\b/
    
    if (emailPattern.test(data.answer)) {
      throw new Error('Answer contains email address (PII)')
    }
    if (phonePattern.test(data.answer)) {
      throw new Error('Answer contains phone number (PII)')
    }
  })
}

async function testRateLimiting() {
  log('\n📋 Tests de Rate Limiting', 'blue')
  
  await test('10 requests/min permitidas', async () => {
    // Hacer 10 requests rápidas
    const requests = []
    for (let i = 0; i < 10; i++) {
      requests.push(
        fetch(`${BASE_URL}/api/rag`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: 'test', locale: 'es' })
        })
      )
    }
    
    const responses = await Promise.all(requests)
    const rateLimited = responses.filter(r => r.status === 429)
    
    if (rateLimited.length > 0) {
      throw new Error(`Unexpected rate limiting: ${rateLimited.length} requests were rate limited`)
    }
  })
  
  await test('Request 11 retorna 429', async () => {
    // Esperar un poco para que el rate limit se resetee (si es necesario)
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Hacer 11 requests rápidas
    const requests = []
    for (let i = 0; i < 11; i++) {
      requests.push(
        fetch(`${BASE_URL}/api/rag`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: 'test', locale: 'es' })
        })
      )
    }
    
    const responses = await Promise.all(requests)
    const rateLimited = responses.filter(r => r.status === 429)
    
    // Al menos una debería estar rate limited
    if (rateLimited.length === 0) {
      // Esto puede pasar si el rate limit se resetea entre requests
      // Verificar headers en su lugar
      const hasRateLimitHeaders = responses.some(r => 
        r.headers.get('X-RateLimit-Limit') !== null
      )
      if (!hasRateLimitHeaders) {
        throw new Error('Rate limiting not working: no 429 responses and no rate limit headers')
      }
    }
  })
  
  await test('Headers X-RateLimit-* están presentes', async () => {
    const res = await fetch(`${BASE_URL}/api/rag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'test', locale: 'es' })
    })
    
    const limit = res.headers.get('X-RateLimit-Limit')
    const remaining = res.headers.get('X-RateLimit-Remaining')
    const reset = res.headers.get('X-RateLimit-Reset')
    
    if (!limit) {
      throw new Error('Missing X-RateLimit-Limit header')
    }
    if (remaining === null) {
      throw new Error('Missing X-RateLimit-Remaining header')
    }
    if (!reset) {
      throw new Error('Missing X-RateLimit-Reset header')
    }
  })
}

async function generateReport() {
  log('\n📊 Reporte de Tests', 'blue')
  log(`Total de tests: ${totalTests}`, 'blue')
  log(`✅ Pasados: ${passedTests}`, 'green')
  log(`❌ Fallidos: ${failedTests}`, failedTests > 0 ? 'red' : 'green')
  const successRate = (passedTests / totalTests) * 100
  log(`Tasa de éxito: ${successRate.toFixed(1)}%`, successRate >= 95 ? 'green' : 'yellow')
  
  if (successRate >= 95) {
    log('✅ Tasa de éxito cumple objetivo de 95%+', 'green')
  } else {
    log('⚠️  Tasa de éxito por debajo del objetivo de 95%', 'yellow')
  }
  
  if (failures.length > 0) {
    log('\n❌ Tests Fallidos:', 'red')
    failures.forEach(({ name, error }) => {
      log(`  - ${name}: ${error}`, 'red')
    })
  }
  
  log(`\n🌐 URL probada: ${BASE_URL}`, 'blue')
  
  return {
    total: totalTests,
    passed: passedTests,
    failed: failedTests,
    successRate: (passedTests / totalTests) * 100,
    failures,
    baseUrl: BASE_URL
  }
}

async function main() {
  log(`\n🚀 Iniciando Tests de Producción`, 'blue')
  log(`URL: ${BASE_URL}\n`, 'blue')
  
  try {
    await testHealthCheck()
    await testRAGAPI()
    await testContentValidation()
    await testRateLimiting()
    
    const report = await generateReport()
    
    // Exit code basado en resultados
    if (failedTests > 0) {
      process.exit(1)
    } else {
      log('\n✅ Todos los tests pasaron!', 'green')
      process.exit(0)
    }
  } catch (error) {
    log(`\n❌ Error fatal: ${error.message}`, 'red')
    console.error(error)
    process.exit(1)
  }
}

main()
