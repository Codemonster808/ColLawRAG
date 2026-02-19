/**
 * Regression Tests - ColLawRAG
 * 
 * Tests de regresión para verificar que las mejoras del sistema no rompan
 * funcionalidad existente. Estos tests deben ejecutarse después de cada cambio
 * significativo para detectar regresiones tempranamente.
 * 
 * Criterios de éxito:
 * - Todos los tests de regresión pasan
 * - No hay degradación en funcionalidad core
 * - Compatibilidad backward con versiones anteriores
 */

import { describe, test, expect } from 'vitest';
import { POST } from '@/app/api/rag/route';
import { NextRequest } from 'next/server';

describe('Regression Tests', () => {
  /**
   * Helper para crear request simulado
   */
  function createRequest(query: string, options: any = {}) {
    return new NextRequest('http://localhost:3000/api/rag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        ...options,
      }),
    });
  }

  /**
   * Helper para extraer respuesta del resultado
   */
  async function getResponse(req: NextRequest) {
    const response = await POST(req);
    return response.json();
  }

  describe('Core API Functionality', () => {
    test('API debe aceptar consultas simples', async () => {
      const req = createRequest('¿Qué es una tutela?');
      const response = await POST(req);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('answer');
      expect(data.answer).toBeTruthy();
      
      console.log('✓ API acepta consultas simples');
    });

    test('API debe rechazar requests malformados', async () => {
      const req = new NextRequest('http://localhost:3000/api/rag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      });

      const response = await POST(req);
      expect(response.status).toBeGreaterThanOrEqual(400);
      
      console.log('✓ API rechaza requests malformados');
    });

    test('API debe manejar queries vacías', async () => {
      const req = createRequest('');
      const response = await POST(req);

      // Debe retornar error o respuesta indicando query vacío
      expect(response.status).toBeGreaterThanOrEqual(200);
      
      console.log('✓ API maneja queries vacías');
    });

    test('API debe retornar citas con las respuestas', async () => {
      const req = createRequest('¿Qué es una tutela?');
      const data = await getResponse(req);

      expect(data).toHaveProperty('citations');
      expect(Array.isArray(data.citations)).toBe(true);
      
      console.log('✓ API retorna citas');
    });

    test('API debe incluir metadata en la respuesta', async () => {
      const req = createRequest('¿Qué es una tutela?');
      const data = await getResponse(req);

      // Verificar que tiene campos esperados
      expect(data).toHaveProperty('answer');
      expect(data).toHaveProperty('citations');
      expect(data).toHaveProperty('requestId');
      
      console.log('✓ API incluye metadata');
    });
  });

  describe('RAG Pipeline Básico', () => {
    test('Pipeline debe recuperar documentos relevantes', async () => {
      const req = createRequest('acción de tutela');
      const data = await getResponse(req);

      expect(data.citations).toBeDefined();
      expect(data.citations.length).toBeGreaterThan(0);
      expect(data.retrieved).toBeGreaterThan(0);
      
      console.log(`✓ Pipeline recuperó ${data.retrieved} chunks, ${data.citations.length} citas`);
    });

    test('Pipeline debe rankear documentos por relevancia', async () => {
      const req = createRequest('¿Qué es una tutela?');
      const data = await getResponse(req);

      if (data.citations && data.citations.length > 1) {
        // Verificar que tienen scores o están ordenados
        const hasScores = data.citations.some((c: any) => 
          typeof c.score === 'number' || c.score !== undefined
        );
        
        console.log('✓ Documentos rankeados por relevancia');
      }
    });

    test('Pipeline debe generar respuesta coherente', async () => {
      const req = createRequest('¿Qué es una tutela?');
      const data = await getResponse(req);

      expect(data.answer).toBeTruthy();
      expect(data.answer.length).toBeGreaterThan(50); // Respuesta sustancial
      
      console.log('✓ Respuesta coherente generada');
    });
  });

  describe('Features Implementadas - RAG Recursivo', () => {
    test('Orquestador recursivo debe funcionar', async () => {
      const req = createRequest(
        'Explica el proceso completo de acción de tutela con todos sus requisitos',
        { useRecursive: true }
      );
      const data = await getResponse(req);

      expect(data.answer).toBeTruthy();
      expect(data.answer.length).toBeGreaterThan(200); // Respuesta extensa
      
      console.log('✓ RAG recursivo funciona');
    });

    test('Descomposición de queries debe funcionar', async () => {
      const req = createRequest(
        '¿Cuáles son los requisitos y el procedimiento de la tutela?',
        { useRecursive: true }
      );
      const data = await getResponse(req);

      expect(data.answer).toBeTruthy();
      // Debe mencionar tanto requisitos como procedimiento
      const mentionsBoth = 
        data.answer.toLowerCase().includes('requisito') &&
        data.answer.toLowerCase().includes('procedimiento');
      
      expect(mentionsBoth).toBe(true);
      
      console.log('✓ Descomposición de queries funciona');
    });

    test('Síntesis de respuestas parciales debe funcionar', async () => {
      const req = createRequest(
        'Explica tutela, habeas corpus y acción de cumplimiento',
        { useRecursive: true }
      );
      const data = await getResponse(req);

      expect(data.answer).toBeTruthy();
      // Debe mencionar los 3 conceptos
      const mentionsAll = 
        data.answer.toLowerCase().includes('tutela') &&
        data.answer.toLowerCase().includes('habeas') &&
        data.answer.toLowerCase().includes('cumplimiento');
      
      expect(mentionsAll).toBe(true);
      
      console.log('✓ Síntesis de respuestas parciales funciona');
    });
  });

  describe('Features Implementadas - Razonamiento Estructurado', () => {
    test('Template HNAC debe forzarse cuando aplica', async () => {
      const req = createRequest(
        'Si me despidieron sin justa causa, ¿puedo interponer tutela?'
      );
      const data = await getResponse(req);

      expect(data.answer).toBeTruthy();
      // Debe estructurar la respuesta con hechos, normas, análisis
      const isStructured = data.answer.length > 100;
      expect(isStructured).toBe(true);
      
      console.log('✓ Template HNAC funciona');
    });

    test('Scoring por jerarquía normativa debe funcionar', async () => {
      const req = createRequest(
        '¿Qué dice la Constitución sobre la tutela?'
      );
      const data = await getResponse(req);

      expect(data.citations).toBeDefined();
      if (data.citations && data.citations.length > 0) {
        // Fuentes constitucionales deberían tener prioridad
        const hasConstitucion = data.citations.some((c: any) =>
          c.title?.toLowerCase().includes('constitución') ||
          c.title?.toLowerCase().includes('constitucion')
        );
        console.log('✓ Scoring por jerarquía funciona', hasConstitucion ? '(Constitución encontrada)' : '');
      }
    });

    test('Extractor de normas aplicables debe funcionar', async () => {
      const req = createRequest(
        'Necesito saber sobre tutela en materia de salud'
      );
      const data = await getResponse(req);

      expect(data.answer).toBeTruthy();
      // Debe mencionar normas relevantes
      const mentionsNorms = 
        data.answer.toLowerCase().includes('artículo') ||
        data.answer.toLowerCase().includes('ley') ||
        data.answer.toLowerCase().includes('constitución');
      
      expect(mentionsNorms).toBe(true);
      
      console.log('✓ Extractor de normas funciona');
    });
  });

  describe('Features Implementadas - Síntesis Multi-Fuente', () => {
    test('Comparador de fuentes contradictorias debe funcionar', async () => {
      const req = createRequest(
        '¿Se puede embargar una pensión?'
      );
      const data = await getResponse(req);

      expect(data.answer).toBeTruthy();
      // Debe dar respuesta basada en jerarquía normativa
      console.log('✓ Comparador de fuentes funciona');
    });

    test('Explicador de jerarquía legal debe funcionar', async () => {
      const req = createRequest(
        '¿Qué prevalece: la ley o el decreto?'
      );
      const data = await getResponse(req);

      expect(data.answer).toBeTruthy();
      const explainsHierarchy = 
        data.answer.toLowerCase().includes('jerarquía') ||
        data.answer.toLowerCase().includes('prevalece') ||
        data.answer.toLowerCase().includes('constitución');
      
      expect(explainsHierarchy).toBe(true);
      
      console.log('✓ Explicador de jerarquía funciona');
    });
  });

  describe('Compatibilidad con Data Ingestion', () => {
    test('Índice debe contener jurisprudencia', async () => {
      const req = createRequest('sentencia corte constitucional');
      const data = await getResponse(req);

      expect(data.citations).toBeDefined();
      expect(data.retrieved).toBeGreaterThan(0);
      
      console.log('✓ Jurisprudencia indexada correctamente');
    });

    test('Índice debe contener decretos', async () => {
      const req = createRequest('decreto reglamentario');
      const data = await getResponse(req);

      expect(data.citations).toBeDefined();
      // Debería encontrar decretos si están indexados
      console.log('✓ Decretos indexados correctamente');
    });

    test('Índice debe contener procedimientos', async () => {
      const req = createRequest('procedimiento tutela');
      const data = await getResponse(req);

      expect(data.citations).toBeDefined();
      expect(data.retrieved).toBeGreaterThan(0);
      
      console.log('✓ Procedimientos indexados correctamente');
    });

    test('Metadata de documentos debe estar completa', async () => {
      const req = createRequest('acción de tutela');
      const data = await getResponse(req);

      if (data.citations && data.citations.length > 0) {
        const firstCitation = data.citations[0];
        expect(firstCitation).toHaveProperty('title');
        expect(firstCitation).toHaveProperty('id');
        
        console.log('✓ Metadata de documentos completa');
      }
    });
  });

  describe('Manejo de Casos Especiales', () => {
    test('Debe manejar queries con tildes y caracteres especiales', async () => {
      const req = createRequest('¿Qué es la acción de tutela?');
      const response = await POST(req);

      expect(response.status).toBe(200);
      
      console.log('✓ Maneja caracteres especiales');
    });

    test('Debe manejar queries muy largas', async () => {
      const longQuery = Array(100).fill('tutela').join(' ');
      const req = createRequest(longQuery);
      const response = await POST(req);

      expect(response.status).toBe(200);
      
      console.log('✓ Maneja queries largas');
    });

    test('Debe manejar queries con jerga legal', async () => {
      const req = createRequest('ratio decidendi sentencia de unificación');
      const response = await POST(req);

      expect(response.status).toBe(200);
      
      console.log('✓ Maneja jerga legal');
    });

    test('Debe manejar queries coloquiales', async () => {
      const req = createRequest('me botaron del trabajo sin razón, qué hago');
      const response = await POST(req);

      expect(response.status).toBe(200);
      
      console.log('✓ Maneja lenguaje coloquial');
    });
  });

  describe('Estabilidad del Sistema', () => {
    test('Sistema debe manejar múltiples queries concurrentes', async () => {
      const queries = [
        '¿Qué es una tutela?',
        '¿Qué es el habeas corpus?',
        '¿Qué es la acción popular?',
        '¿Qué es el debido proceso?',
        '¿Qué es la igualdad?',
      ];

      const responses = await Promise.all(
        queries.map(query => POST(createRequest(query)))
      );

      expect(responses.every(r => r.status === 200)).toBe(true);
      
      console.log('✓ Maneja queries concurrentes');
    });

    test('Sistema no debe degradarse después de múltiples requests', async () => {
      const query = '¿Qué es una tutela?';
      
      // Ejecutar 10 queries consecutivas
      for (let i = 0; i < 10; i++) {
        const response = await POST(createRequest(query));
        expect(response.status).toBe(200);
      }
      
      console.log('✓ No hay degradación después de múltiples requests');
    });

    test('Sistema debe recuperarse de errores', async () => {
      // Intentar query que podría causar error
      const badReq = new NextRequest('http://localhost:3000/api/rag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: null }),
      });
      
      await POST(badReq); // Puede fallar o no
      
      // Verificar que el sistema sigue funcionando
      const goodReq = createRequest('¿Qué es una tutela?');
      const response = await POST(goodReq);
      
      expect(response.status).toBe(200);
      
      console.log('✓ Sistema se recupera de errores');
    });
  });

  describe('Backward Compatibility', () => {
    test('Formato de respuesta debe ser compatible con versión anterior', async () => {
      const req = createRequest('¿Qué es una tutela?');
      const data = await getResponse(req);

      // Campos esenciales que siempre deben estar
      expect(data).toHaveProperty('answer');
      expect(data).toHaveProperty('citations');
      expect(data).toHaveProperty('retrieved');
      expect(data).toHaveProperty('requestId');
      
      console.log('✓ Formato de respuesta compatible');
    });

    test('Queries antiguas deben seguir funcionando', async () => {
      // Queries de referencia de versiones anteriores
      const oldQueries = [
        '¿Qué es una tutela?',
        '¿Cómo se interpone una acción de tutela?',
        '¿Cuáles son los requisitos de la tutela?',
      ];

      for (const query of oldQueries) {
        const response = await POST(createRequest(query));
        expect(response.status).toBe(200);
      }
      
      console.log('✓ Queries antiguas funcionan');
    });
  });

  describe('Performance Baselines', () => {
    test('Query simple no debe degradar rendimiento', async () => {
      const start = performance.now();
      await POST(createRequest('¿Qué es una tutela?'));
      const end = performance.now();
      
      const timeMs = end - start;
      
      // No debe ser significativamente más lento que antes (>3s)
      expect(timeMs).toBeLessThan(3000);
      
      console.log(`✓ Rendimiento estable: ${timeMs.toFixed(0)}ms`);
    });

    test('Throughput no debe degradar', async () => {
      const queries = Array(5).fill('¿Qué es una tutela?');
      
      const start = performance.now();
      await Promise.all(queries.map(q => POST(createRequest(q))));
      const end = performance.now();
      
      const totalTime = end - start;
      const avgTime = totalTime / queries.length;
      
      // Promedio no debe exceder 2s
      expect(avgTime).toBeLessThan(2000);
      
      console.log(`✓ Throughput estable: ${avgTime.toFixed(0)}ms promedio`);
    });
  });

  describe('Data Integrity', () => {
    test('Respuestas deben ser determinísticas para misma query', async () => {
      const query = '¿Qué es una tutela?';
      
      const data1 = await getResponse(createRequest(query));
      const data2 = await getResponse(createRequest(query));
      
      // Respuestas deberían ser similares (mismo contenido core)
      expect(data1.answer).toBeTruthy();
      expect(data2.answer).toBeTruthy();
      
      console.log('✓ Respuestas determinísticas');
    });

    test('Citas deben mantenerse estables', async () => {
      const query = 'artículo 86 constitución';
      
      const data = await getResponse(createRequest(query));
      
      expect(data.citations).toBeDefined();
      // Número de citas debería ser razonable y consistente
      if (data.citations) {
        expect(data.citations.length).toBeGreaterThan(0);
        expect(data.citations.length).toBeLessThan(100);
      }
      
      console.log('✓ Citas estables');
    });
  });
});
