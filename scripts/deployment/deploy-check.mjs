#!/usr/bin/env node
/**
 * Script para verificar el deployment después de hacer deploy
 * Verifica que los endpoints funcionan correctamente
 */

import fetch from 'node-fetch'

const BASE_URL = process.env.VERCEL_URL 
  ? `https://${process.env.VERCEL_URL}` 
  : process.env.DEPLOY_URL || 'http://localhost:3000'

async function checkHealth() {
  try {
    const url = `${BASE_URL}/api/health`
    console.log(`🔍 Verificando health check: ${url}`)
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) {
      return {
        success: false,
        message: `Health check falló con status ${response.status}`,
        details: await response.text()
      }
    }
    
    const data = await response.json()
    
    if (data.status === 'healthy') {
      return {
        success: true,
        message: '✅ Health check: HEALTHY',
        details: data
      }
    } else if (data.status === 'degraded') {
      return {
        success: true,
        message: '⚠️  Health check: DEGRADED (funciona parcialmente)',
        details: data
      }
    } else {
      return {
        success: false,
        message: '❌ Health check: UNHEALTHY',
        details: data
      }
    }
  } catch (error) {
    return {
      success: false,
      message: `❌ Error al verificar health check: ${error.message}`,
      details: error
    }
  }
}

async function checkRAGAPI() {
  try {
    const url = `${BASE_URL}/api/rag`
    console.log(`🔍 Verificando API RAG: ${url}`)
    
    const testQuery = {
      query: '¿Qué es la acción de tutela?',
      locale: 'es'
    }
    
    const headers = {
      'Content-Type': 'application/json'
    }
    
    // Si hay API key configurada, intentar sin ella primero (debe fallar si está protegida)
    if (process.env.RAG_API_KEY) {
      const responseWithoutKey = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(testQuery)
      })
      
      if (responseWithoutKey.status === 401) {
        console.log('✅ API está protegida con API key (esperado)')
        headers['x-api-key'] = process.env.RAG_API_KEY
      }
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(testQuery)
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      return {
        success: false,
        message: `API RAG falló con status ${response.status}`,
        details: errorText
      }
    }
    
    const data = await response.json()
    
    if (data.answer && data.citations) {
      return {
        success: true,
        message: '✅ API RAG funciona correctamente',
        details: {
          answerLength: data.answer.length,
          citationsCount: data.citations.length,
          requestId: data.requestId
        }
      }
    } else {
      return {
        success: false,
        message: '⚠️  API RAG responde pero formato inesperado',
        details: data
      }
    }
  } catch (error) {
    return {
      success: false,
      message: `❌ Error al verificar API RAG: ${error.message}`,
      details: error
    }
  }
}

async function checkRateLimiting() {
  try {
    const url = `${BASE_URL}/api/rag`
    console.log(`🔍 Verificando rate limiting: ${url}`)
    
    const headers = {
      'Content-Type': 'application/json'
    }
    
    if (process.env.RAG_API_KEY) {
      headers['x-api-key'] = process.env.RAG_API_KEY
    }
    
    // Hacer múltiples requests rápidas para probar rate limiting
    const requests = []
    for (let i = 0; i < 12; i++) {
      requests.push(
        fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({ query: `Test query ${i}`, locale: 'es' })
        }).then(r => ({ status: r.status, headers: Object.fromEntries(r.headers) }))
      )
    }
    
    const results = await Promise.all(requests)
    const rateLimited = results.filter(r => r.status === 429)
    
    if (rateLimited.length > 0) {
      return {
        success: true,
        message: `✅ Rate limiting funciona (${rateLimited.length} requests bloqueadas)`,
        details: {
          totalRequests: results.length,
          rateLimited: rateLimited.length,
          successful: results.filter(r => r.status === 200).length
        }
      }
    } else {
      return {
        success: true,
        message: '⚠️  Rate limiting no se activó (puede ser normal si el límite es alto)',
        details: {
          totalRequests: results.length,
          allStatuses: results.map(r => r.status)
        }
      }
    }
  } catch (error) {
    return {
      success: false,
      message: `❌ Error al verificar rate limiting: ${error.message}`,
      details: error
    }
  }
}

async function checkSecurityHeaders() {
  try {
    const url = `${BASE_URL}/api/health`
    console.log(`🔍 Verificando headers de seguridad: ${url}`)
    
    const response = await fetch(url, {
      method: 'GET'
    })
    
    const headers = Object.fromEntries(response.headers)
    const securityHeaders = {
      'x-content-type-options': headers['x-content-type-options'],
      'x-frame-options': headers['x-frame-options'],
      'x-xss-protection': headers['x-xss-protection'],
      'referrer-policy': headers['referrer-policy']
    }
    
    const missing = Object.entries(securityHeaders)
      .filter(([_, value]) => !value)
      .map(([key, _]) => key)
    
    if (missing.length === 0) {
      return {
        success: true,
        message: '✅ Headers de seguridad presentes',
        details: securityHeaders
      }
    } else {
      return {
        success: false,
        message: `⚠️  Faltan headers de seguridad: ${missing.join(', ')}`,
        details: securityHeaders
      }
    }
  } catch (error) {
    return {
      success: false,
      message: `❌ Error al verificar headers: ${error.message}`,
      details: error
    }
  }
}

async function main() {
  console.log('='.repeat(80))
  console.log('VERIFICACIÓN POST-DEPLOYMENT')
  console.log('='.repeat(80))
  console.log(`URL base: ${BASE_URL}`)
  console.log()
  
  const checks = [
    { name: 'Health Check', fn: checkHealth },
    { name: 'API RAG', fn: checkRAGAPI },
    { name: 'Rate Limiting', fn: checkRateLimiting },
    { name: 'Security Headers', fn: checkSecurityHeaders }
  ]
  
  const results = []
  
  for (const check of checks) {
    console.log(`\n📋 ${check.name}:`)
    console.log('-'.repeat(80))
    const result = await check[check.name.toLowerCase().replace(' ', '')]()
    console.log(result.message)
    if (result.details && typeof result.details === 'object') {
      console.log('   Detalles:', JSON.stringify(result.details, null, 2))
    }
    results.push({ ...result, name: check.name })
  }
  
  console.log()
  console.log('='.repeat(80))
  console.log('RESUMEN:')
  console.log('-'.repeat(80))
  
  const successful = results.filter(r => r.success).length
  const failed = results.filter(r => !r.success).length
  
  results.forEach(r => {
    const icon = r.success ? '✅' : '❌'
    console.log(`${icon} ${r.name}: ${r.success ? 'OK' : 'FALLÓ'}`)
  })
  
  console.log()
  console.log(`Total: ${successful} exitosos, ${failed} fallidos`)
  
  if (failed > 0) {
    console.log()
    console.log('⚠️  Algunas verificaciones fallaron. Revisa los detalles arriba.')
    process.exit(1)
  } else {
    console.log()
    console.log('✅ Todas las verificaciones pasaron. El deployment está funcionando correctamente.')
    process.exit(0)
  }
}

main().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})
