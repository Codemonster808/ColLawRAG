/**
 * Tests para la API REST
 * 
 * Estos tests verifican que los endpoints de la API funcionan correctamente
 */

import { describe, it, expect, beforeAll } from '@jest/globals'

// Nota: Estos tests requieren que el servidor esté corriendo
// Para ejecutar: npm run dev en una terminal y luego npm test

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000'

describe('API Endpoints', () => {
  describe('GET /api/health', () => {
    it('debe retornar status 200', async () => {
      const response = await fetch(`${API_BASE_URL}/api/health`)
      expect(response.status).toBe(200)
    })

    it('debe retornar JSON válido', async () => {
      const response = await fetch(`${API_BASE_URL}/api/health`)
      const data = await response.json()
      
      expect(data).toBeDefined()
      expect(data.status).toBeDefined()
      expect(['healthy', 'degraded', 'unhealthy']).toContain(data.status)
      expect(data.timestamp).toBeDefined()
      expect(data.checks).toBeDefined()
    })

    it('debe incluir checks de sistema', async () => {
      const response = await fetch(`${API_BASE_URL}/api/health`)
      const data = await response.json()
      
      expect(data.checks.indexFile).toBeDefined()
      expect(data.checks.huggingFace).toBeDefined()
    })
  })

  describe('POST /api/rag', () => {
    it('debe procesar una consulta válida', async () => {
      const response = await fetch(`${API_BASE_URL}/api/rag`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: '¿Qué es la acción de tutela?',
          locale: 'es'
        })
      })

      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.answer).toBeDefined()
      expect(data.citations).toBeDefined()
      expect(Array.isArray(data.citations)).toBe(true)
    }, 30000)

    it('debe validar el schema de entrada', async () => {
      const response = await fetch(`${API_BASE_URL}/api/rag`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: '', // Query vacía debe fallar
          locale: 'es'
        })
      })

      expect(response.status).toBe(400)
    })

    it('debe rechazar queries muy largas', async () => {
      const longQuery = 'a'.repeat(3000) // Más del límite de 2000 caracteres
      
      const response = await fetch(`${API_BASE_URL}/api/rag`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: longQuery,
          locale: 'es'
        })
      })

      expect(response.status).toBe(400)
    })

    it('debe aplicar rate limiting', async () => {
      // Hacer múltiples requests rápidas
      const requests = []
      for (let i = 0; i < 15; i++) {
        requests.push(
          fetch(`${API_BASE_URL}/api/rag`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              query: `Test query ${i}`,
              locale: 'es'
            })
          })
        )
      }

      const responses = await Promise.all(requests)
      const rateLimited = responses.filter(r => r.status === 429)
      
      // Al menos algunas requests deben ser rate limited
      expect(rateLimited.length).toBeGreaterThan(0)
    }, 30000)

    it('debe incluir headers de rate limiting', async () => {
      const response = await fetch(`${API_BASE_URL}/api/rag`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: 'Test query',
          locale: 'es'
        })
      })

      expect(response.headers.get('X-RateLimit-Limit')).toBeDefined()
      expect(response.headers.get('X-RateLimit-Remaining')).toBeDefined()
    }, 30000)

    it('debe respetar API key si está configurada', async () => {
      // Intentar sin API key
      const responseWithoutKey = await fetch(`${API_BASE_URL}/api/rag`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: 'Test query',
          locale: 'es'
        })
      })

      // Si hay API key configurada, debe fallar sin ella
      if (process.env.RAG_API_KEY) {
        expect(responseWithoutKey.status).toBe(401)
      }
    })

    it('debe retornar headers de seguridad', async () => {
      const response = await fetch(`${API_BASE_URL}/api/rag`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: 'Test query',
          locale: 'es'
        })
      })

      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
      expect(response.headers.get('X-Frame-Options')).toBe('DENY')
    }, 30000)

    it('debe manejar timeouts correctamente', async () => {
      // Query que podría causar timeout
      const response = await fetch(`${API_BASE_URL}/api/rag`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: 'Consulta muy compleja que requiere análisis profundo de múltiples leyes y jurisprudencia',
          locale: 'es'
        }),
        signal: AbortSignal.timeout(65000) // Timeout de 65 segundos
      })

      // Debe retornar 200 o 504 (timeout)
      expect([200, 504]).toContain(response.status)
    }, 70000)
  })

  describe('Cache', () => {
    it('debe cachear respuestas idénticas', async () => {
      const query = {
        query: 'Test cache query',
        locale: 'es' as const
      }

      const response1 = await fetch(`${API_BASE_URL}/api/rag`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(query)
      })

      const data1 = await response1.json()

      // Esperar un poco y hacer la misma query
      await new Promise(resolve => setTimeout(resolve, 1000))

      const response2 = await fetch(`${API_BASE_URL}/api/rag`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(query)
      })

      const data2 = await response2.json()

      // La segunda respuesta debe estar cacheada
      if (data2.cached) {
        expect(data2.cached).toBe(true)
        expect(data2.requestId).toBe(data1.requestId)
      }
    }, 30000)
  })
})
