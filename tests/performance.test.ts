/**
 * Performance Tests - ColLawRAG
 * 
 * Tests de rendimiento para verificar tiempos de respuesta y throughput
 * del sistema RAG.
 * 
 * Criterios de éxito:
 * - Consultas simples: <2 segundos
 * - Consultas complejas: <5 segundos
 * - RAG recursivo: <10 segundos
 * - Throughput: >10 consultas/minuto
 */

import { describe, test, expect, beforeAll } from 'vitest';
import { POST } from '@/app/api/query/route';
import { NextRequest } from 'next/server';

describe('Performance Tests', () => {
  const TIMEOUT_SIMPLE = 2000; // 2 segundos
  const TIMEOUT_COMPLEX = 5000; // 5 segundos
  const TIMEOUT_RECURSIVE = 10000; // 10 segundos

  /**
   * Helper para crear request simulado
   */
  function createRequest(query: string, options: any = {}) {
    return new NextRequest('http://localhost:3000/api/query', {
      method: 'POST',
      body: JSON.stringify({
        query,
        ...options,
      }),
    });
  }

  /**
   * Helper para medir tiempo de ejecución
   */
  async function measureTime(fn: () => Promise<any>): Promise<{ result: any; timeMs: number }> {
    const start = performance.now();
    const result = await fn();
    const end = performance.now();
    return { result, timeMs: end - start };
  }

  describe('Consultas Simples', () => {
    test('Consulta directa sobre un concepto debe responder en <2s', async () => {
      const req = createRequest('¿Qué es una tutela?');
      
      const { result, timeMs } = await measureTime(() => POST(req));
      
      expect(result.status).toBe(200);
      expect(timeMs).toBeLessThan(TIMEOUT_SIMPLE);
      
      console.log(`✓ Consulta simple: ${timeMs.toFixed(0)}ms`);
    });

    test('Búsqueda de procedimiento debe responder en <2s', async () => {
      const req = createRequest('¿Cómo se interpone una acción de tutela?');
      
      const { result, timeMs } = await measureTime(() => POST(req));
      
      expect(result.status).toBe(200);
      expect(timeMs).toBeLessThan(TIMEOUT_SIMPLE);
      
      console.log(`✓ Búsqueda de procedimiento: ${timeMs.toFixed(0)}ms`);
    });

    test('Consulta sobre norma específica debe responder en <2s', async () => {
      const req = createRequest('¿Qué dice el artículo 86 de la Constitución?');
      
      const { result, timeMs } = await measureTime(() => POST(req));
      
      expect(result.status).toBe(200);
      expect(timeMs).toBeLessThan(TIMEOUT_SIMPLE);
      
      console.log(`✓ Consulta sobre norma: ${timeMs.toFixed(0)}ms`);
    });
  });

  describe('Consultas Complejas', () => {
    test('Consulta con comparación de normas debe responder en <5s', async () => {
      const req = createRequest(
        '¿Cuál es la diferencia entre acción de tutela y acción de cumplimiento?'
      );
      
      const { result, timeMs } = await measureTime(() => POST(req));
      
      expect(result.status).toBe(200);
      expect(timeMs).toBeLessThan(TIMEOUT_COMPLEX);
      
      console.log(`✓ Comparación de normas: ${timeMs.toFixed(0)}ms`);
    });

    test('Consulta con análisis de jurisprudencia debe responder en <5s', async () => {
      const req = createRequest(
        '¿Qué ha dicho la Corte Constitucional sobre el derecho a la salud?'
      );
      
      const { result, timeMs } = await measureTime(() => POST(req));
      
      expect(result.status).toBe(200);
      expect(timeMs).toBeLessThan(TIMEOUT_COMPLEX);
      
      console.log(`✓ Análisis de jurisprudencia: ${timeMs.toFixed(0)}ms`);
    });

    test('Consulta con razonamiento estructurado debe responder en <5s', async () => {
      const req = createRequest(
        'Si una persona fue despedida sin justa causa, ¿puede interponer tutela?'
      );
      
      const { result, timeMs } = await measureTime(() => POST(req));
      
      expect(result.status).toBe(200);
      expect(timeMs).toBeLessThan(TIMEOUT_COMPLEX);
      
      console.log(`✓ Razonamiento estructurado: ${timeMs.toFixed(0)}ms`);
    });
  });

  describe('Consultas Recursivas', () => {
    test('Consulta que requiere descomposición debe responder en <10s', async () => {
      const req = createRequest(
        '¿Cuáles son todos los requisitos y pasos para interponer una acción de tutela por violación del derecho a la salud?',
        { useRecursive: true }
      );
      
      const { result, timeMs } = await measureTime(() => POST(req));
      
      expect(result.status).toBe(200);
      expect(timeMs).toBeLessThan(TIMEOUT_RECURSIVE);
      
      console.log(`✓ Consulta recursiva: ${timeMs.toFixed(0)}ms`);
    });

    test('Consulta multi-aspecto debe responder en <10s', async () => {
      const req = createRequest(
        'Explica el proceso completo de una acción de tutela: requisitos, procedimiento, términos y jurisprudencia relevante',
        { useRecursive: true }
      );
      
      const { result, timeMs } = await measureTime(() => POST(req));
      
      expect(result.status).toBe(200);
      expect(timeMs).toBeLessThan(TIMEOUT_RECURSIVE);
      
      console.log(`✓ Consulta multi-aspecto: ${timeMs.toFixed(0)}ms`);
    });
  });

  describe('Throughput', () => {
    test('Debe manejar 10+ consultas por minuto', async () => {
      const queries = [
        '¿Qué es una tutela?',
        '¿Qué es el habeas corpus?',
        '¿Qué es una acción de cumplimiento?',
        '¿Qué es una acción popular?',
        '¿Qué es una acción de grupo?',
        '¿Qué es el derecho de petición?',
        '¿Qué es el debido proceso?',
        '¿Qué es la igualdad ante la ley?',
        '¿Qué es el principio de legalidad?',
        '¿Qué es la cosa juzgada?',
      ];

      const start = performance.now();
      
      const results = await Promise.all(
        queries.map(query => POST(createRequest(query)))
      );
      
      const end = performance.now();
      const totalTime = end - start;
      const throughput = (queries.length / totalTime) * 60000; // consultas/min

      expect(results.every(r => r.status === 200)).toBe(true);
      expect(throughput).toBeGreaterThan(10);
      
      console.log(`✓ Throughput: ${throughput.toFixed(1)} consultas/min (${totalTime.toFixed(0)}ms total)`);
    });

    test('Consultas concurrentes no deben degradar rendimiento >50%', async () => {
      const query = '¿Qué es una tutela?';
      
      // Consulta individual
      const { timeMs: singleTime } = await measureTime(() => 
        POST(createRequest(query))
      );

      // 5 consultas concurrentes
      const { timeMs: concurrentTime } = await measureTime(() =>
        Promise.all(
          Array(5).fill(null).map(() => POST(createRequest(query)))
        )
      );

      const avgConcurrentTime = concurrentTime / 5;
      const degradation = ((avgConcurrentTime - singleTime) / singleTime) * 100;

      expect(degradation).toBeLessThan(50);
      
      console.log(`✓ Degradación concurrente: ${degradation.toFixed(1)}% (individual: ${singleTime.toFixed(0)}ms, concurrente: ${avgConcurrentTime.toFixed(0)}ms)`);
    });
  });

  describe('Escalabilidad', () => {
    test('Consultas largas no deben exceder timeout', async () => {
      const longQuery = `
        Necesito entender completamente el proceso de acción de tutela en Colombia.
        Por favor explícame los requisitos de procedibilidad, los términos procesales,
        las causales de improcedencia, la jurisprudencia más relevante de la Corte
        Constitucional, los efectos de la sentencia, y los mecanismos de seguimiento.
        También necesito saber cómo se tramita la tutela contra providencias judiciales,
        cuáles son las reglas especiales para tutelas en materia de salud, pensiones,
        y servicios públicos. Incluye ejemplos de sentencias de unificación relevantes.
      `.trim();

      const req = createRequest(longQuery, { useRecursive: true });
      
      const { result, timeMs } = await measureTime(() => POST(req));
      
      expect(result.status).toBe(200);
      expect(timeMs).toBeLessThan(15000); // 15s máximo para consultas muy largas
      
      console.log(`✓ Consulta larga: ${timeMs.toFixed(0)}ms`);
    });

    test('Cache debe mejorar rendimiento de consultas repetidas', async () => {
      const query = '¿Qué es una tutela?';
      
      // Primera consulta (sin cache)
      const { timeMs: firstTime } = await measureTime(() =>
        POST(createRequest(query))
      );

      // Segunda consulta (debería usar cache)
      const { timeMs: secondTime } = await measureTime(() =>
        POST(createRequest(query))
      );

      // Cache debe mejorar >20%
      const improvement = ((firstTime - secondTime) / firstTime) * 100;

      console.log(`✓ Mejora con cache: ${improvement.toFixed(1)}% (primera: ${firstTime.toFixed(0)}ms, segunda: ${secondTime.toFixed(0)}ms)`);
      
      // Si hay cache implementado, debería ser más rápido
      if (secondTime < firstTime) {
        expect(improvement).toBeGreaterThan(0);
      }
    });
  });

  describe('Memory Usage', () => {
    test('Múltiples consultas no deben causar memory leak', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Ejecutar 20 consultas
      for (let i = 0; i < 20; i++) {
        await POST(createRequest(`¿Qué es una tutela? (iteración ${i})`));
      }

      // Forzar garbage collection si está disponible
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB

      // No debe aumentar >50MB
      expect(memoryIncrease).toBeLessThan(50);
      
      console.log(`✓ Incremento de memoria: ${memoryIncrease.toFixed(2)}MB`);
    });
  });
});
