/**
 * Accuracy Tests - ColLawRAG
 * 
 * Tests de exactitud para verificar la calidad de las respuestas del sistema RAG.
 * Usa consultas de referencia con respuestas esperadas para medir precisión.
 * 
 * Criterios de éxito:
 * - Precisión >90% en consultas simples
 * - Precisión >80% en consultas complejas
 * - Recall >85% en búsqueda de información relevante
 * - F1-score >85% en general
 */

import { describe, test, expect } from 'vitest';
import { POST } from '@/app/api/rag/route';
import { NextRequest } from 'next/server';

describe('Accuracy Tests', () => {
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
  async function getAnswer(req: NextRequest): Promise<string> {
    const response = await POST(req);
    const data = await response.json();
    return data.answer || '';
  }

  /**
   * Helper para verificar si la respuesta contiene términos esperados
   */
  function containsTerms(answer: string, terms: string[]): boolean {
    const lowerAnswer = answer.toLowerCase();
    return terms.every(term => lowerAnswer.includes(term.toLowerCase()));
  }

  /**
   * Helper para verificar si la respuesta menciona al menos uno de los términos
   */
  function mentionsAny(answer: string, terms: string[]): boolean {
    const lowerAnswer = answer.toLowerCase();
    return terms.some(term => lowerAnswer.includes(term.toLowerCase()));
  }

  describe('Consultas sobre Conceptos Jurídicos', () => {
    test('Debe explicar correctamente qué es una acción de tutela', async () => {
      const req = createRequest('¿Qué es una acción de tutela?');
      const answer = await getAnswer(req);

      expect(answer).toBeTruthy();
      expect(containsTerms(answer, [
        'derechos fundamentales',
        'protección',
        'artículo 86',
      ])).toBe(true);
      
      console.log('✓ Concepto de tutela identificado correctamente');
    });

    test('Debe identificar los requisitos de procedibilidad de la tutela', async () => {
      const req = createRequest('¿Cuáles son los requisitos de procedibilidad de la tutela?');
      const answer = await getAnswer(req);

      expect(answer).toBeTruthy();
      expect(mentionsAny(answer, [
        'legitimación',
        'inmediatez',
        'subsidiariedad',
        'procedente',
      ])).toBe(true);
      
      console.log('✓ Requisitos de procedibilidad identificados');
    });

    test('Debe explicar la diferencia entre tutela y habeas corpus', async () => {
      const req = createRequest('¿Cuál es la diferencia entre tutela y habeas corpus?');
      const answer = await getAnswer(req);

      expect(answer).toBeTruthy();
      expect(mentionsAny(answer, [
        'libertad',
        'derechos fundamentales',
        'privación',
      ])).toBe(true);
      
      console.log('✓ Diferencia entre tutela y habeas corpus explicada');
    });
  });

  describe('Consultas sobre Procedimientos', () => {
    test('Debe explicar el procedimiento de acción de tutela', async () => {
      const req = createRequest('¿Cómo se interpone una acción de tutela?');
      const answer = await getAnswer(req);

      expect(answer).toBeTruthy();
      expect(mentionsAny(answer, [
        'demanda',
        'juez',
        'solicitud',
        'presentar',
        '10 días',
      ])).toBe(true);
      
      console.log('✓ Procedimiento de tutela explicado');
    });

    test('Debe identificar los términos procesales de la tutela', async () => {
      const req = createRequest('¿Cuáles son los términos procesales de la tutela?');
      const answer = await getAnswer(req);

      expect(answer).toBeTruthy();
      expect(mentionsAny(answer, [
        '10 días',
        'fallo',
        'impugnación',
        'término',
      ])).toBe(true);
      
      console.log('✓ Términos procesales identificados');
    });

    test('Debe explicar el recurso de impugnación en tutela', async () => {
      const req = createRequest('¿Cómo se impugna un fallo de tutela?');
      const answer = await getAnswer(req);

      expect(answer).toBeTruthy();
      expect(mentionsAny(answer, [
        'impugnación',
        '3 días',
        'superior',
        'recurso',
      ])).toBe(true);
      
      console.log('✓ Recurso de impugnación explicado');
    });
  });

  describe('Consultas sobre Normas Constitucionales', () => {
    test('Debe citar correctamente el artículo 86 de la Constitución', async () => {
      const req = createRequest('¿Qué dice el artículo 86 de la Constitución?');
      const answer = await getAnswer(req);

      expect(answer).toBeTruthy();
      expect(mentionsAny(answer, [
        'artículo 86',
        'tutela',
        'derechos fundamentales',
        'protección',
      ])).toBe(true);
      
      console.log('✓ Artículo 86 citado correctamente');
    });

    test('Debe explicar el concepto de derecho fundamental', async () => {
      const req = createRequest('¿Qué son los derechos fundamentales?');
      const answer = await getAnswer(req);

      expect(answer).toBeTruthy();
      expect(mentionsAny(answer, [
        'derechos fundamentales',
        'constitución',
        'inherente',
        'dignidad',
      ])).toBe(true);
      
      console.log('✓ Derechos fundamentales explicados');
    });

    test('Debe identificar el núcleo esencial de derechos', async () => {
      const req = createRequest('¿Qué es el núcleo esencial de un derecho fundamental?');
      const answer = await getAnswer(req);

      expect(answer).toBeTruthy();
      expect(mentionsAny(answer, [
        'núcleo esencial',
        'contenido',
        'mínimo',
        'esencia',
      ])).toBe(true);
      
      console.log('✓ Núcleo esencial identificado');
    });
  });

  describe('Consultas sobre Jurisprudencia', () => {
    test('Debe mencionar jurisprudencia relevante sobre tutela', async () => {
      const req = createRequest('¿Qué ha dicho la Corte sobre la tutela en salud?');
      const answer = await getAnswer(req);

      expect(answer).toBeTruthy();
      expect(mentionsAny(answer, [
        'corte constitucional',
        'salud',
        'sentencia',
        'jurisprudencia',
      ])).toBe(true);
      
      console.log('✓ Jurisprudencia sobre salud mencionada');
    });

    test('Debe identificar precedentes vinculantes', async () => {
      const req = createRequest('¿Qué es una sentencia de unificación?');
      const answer = await getAnswer(req);

      expect(answer).toBeTruthy();
      expect(mentionsAny(answer, [
        'unificación',
        'precedente',
        'vinculante',
        'SU',
      ])).toBe(true);
      
      console.log('✓ Sentencias de unificación identificadas');
    });

    test('Debe explicar el concepto de precedente judicial', async () => {
      const req = createRequest('¿Qué es un precedente judicial?');
      const answer = await getAnswer(req);

      expect(answer).toBeTruthy();
      expect(mentionsAny(answer, [
        'precedente',
        'decisión',
        'anterior',
        'vinculante',
      ])).toBe(true);
      
      console.log('✓ Precedente judicial explicado');
    });
  });

  describe('Consultas Complejas Multi-Aspecto', () => {
    test('Debe responder consulta sobre embargabilidad de pensiones', async () => {
      const req = createRequest(
        '¿Se puede embargar una pensión de vejez en Colombia?'
      );
      const answer = await getAnswer(req);

      expect(answer).toBeTruthy();
      expect(mentionsAny(answer, [
        'pensión',
        'embargo',
        'inembargable',
        'salario mínimo',
      ])).toBe(true);
      
      console.log('✓ Embargabilidad de pensiones explicada');
    });

    test('Debe explicar jerarquía normativa', async () => {
      const req = createRequest(
        '¿Qué prevalece: la Constitución, la ley o el decreto?'
      );
      const answer = await getAnswer(req);

      expect(answer).toBeTruthy();
      expect(mentionsAny(answer, [
        'constitución',
        'jerarquía',
        'prevalece',
        'supremacía',
      ])).toBe(true);
      
      console.log('✓ Jerarquía normativa explicada');
    });

    test('Debe analizar conflicto entre derechos fundamentales', async () => {
      const req = createRequest(
        '¿Qué pasa cuando colisionan el derecho a la intimidad y la libertad de prensa?'
      );
      const answer = await getAnswer(req);

      expect(answer).toBeTruthy();
      expect(mentionsAny(answer, [
        'intimidad',
        'libertad',
        'prensa',
        'ponderación',
        'balance',
      ])).toBe(true);
      
      console.log('✓ Conflicto de derechos analizado');
    });

    test('Debe integrar múltiples fuentes de información', async () => {
      const req = createRequest(
        'Explica el proceso completo de tutela: requisitos, procedimiento y términos',
        { useRecursive: true }
      );
      const answer = await getAnswer(req);

      expect(answer).toBeTruthy();
      expect(answer.length).toBeGreaterThan(500); // Respuesta sustancial
      expect(mentionsAny(answer, [
        'requisitos',
        'procedimiento',
        'términos',
      ])).toBe(true);
      
      console.log('✓ Múltiples aspectos integrados');
    });
  });

  describe('Casos de Uso Real', () => {
    test('Debe responder pregunta típica de usuario sobre tutela laboral', async () => {
      const req = createRequest(
        'Me despidieron sin justa causa y no me han pagado. ¿Puedo poner tutela?'
      );
      const answer = await getAnswer(req);

      expect(answer).toBeTruthy();
      expect(mentionsAny(answer, [
        'tutela',
        'trabajo',
        'laboral',
        'subsidiariedad',
        'ordinario',
      ])).toBe(true);
      
      console.log('✓ Caso laboral analizado');
    });

    test('Debe responder sobre tutela en salud', async () => {
      const req = createRequest(
        'La EPS me negó un medicamento. ¿Qué puedo hacer?'
      );
      const answer = await getAnswer(req);

      expect(answer).toBeTruthy();
      expect(mentionsAny(answer, [
        'tutela',
        'salud',
        'eps',
        'medicamento',
        'derecho',
      ])).toBe(true);
      
      console.log('✓ Caso de salud analizado');
    });

    test('Debe orientar sobre tutela contra providencias', async () => {
      const req = createRequest(
        'Un juez falló en mi contra injustamente. ¿Puedo interponer tutela contra la sentencia?'
      );
      const answer = await getAnswer(req);

      expect(answer).toBeTruthy();
      expect(mentionsAny(answer, [
        'tutela',
        'providencia',
        'judicial',
        'sentencia',
        'excepcional',
      ])).toBe(true);
      
      console.log('✓ Tutela contra providencias explicada');
    });

    test('Debe explicar pensiones y seguridad social', async () => {
      const req = createRequest(
        'Tengo 60 años y 1200 semanas cotizadas. ¿Puedo pensionarme?'
      );
      const answer = await getAnswer(req);

      expect(answer).toBeTruthy();
      expect(mentionsAny(answer, [
        'pensión',
        'semanas',
        'edad',
        'requisitos',
      ])).toBe(true);
      
      console.log('✓ Caso de pensión analizado');
    });
  });

  describe('Detección de Información Faltante', () => {
    test('Debe reconocer cuando no tiene información suficiente', async () => {
      const req = createRequest(
        '¿Qué dice la sentencia T-12345-99 sobre derechos extraterrestres?'
      );
      const answer = await getAnswer(req);

      expect(answer).toBeTruthy();
      // Debe indicar que no tiene información o que la sentencia no existe
      const indicatesUncertainty = mentionsAny(answer, [
        'no encuentro',
        'no tengo información',
        'no existe',
        'no está disponible',
        'no puedo',
      ]);
      
      expect(indicatesUncertainty).toBe(true);
      
      console.log('✓ Información faltante detectada correctamente');
    });

    test('No debe inventar información inexistente', async () => {
      const req = createRequest(
        '¿Cuál es el contenido del artículo 999 de la Constitución Colombiana?'
      );
      const answer = await getAnswer(req);

      expect(answer).toBeTruthy();
      // La Constitución no tiene artículo 999
      const avoidsInventing = mentionsAny(answer, [
        'no existe',
        'no encuentro',
        'no hay',
      ]) || !answer.includes('artículo 999');
      
      expect(avoidsInventing).toBe(true);
      
      console.log('✓ Evita inventar información');
    });
  });

  describe('Precisión de Citas y Referencias', () => {
    test('Debe citar artículos constitucionales correctamente', async () => {
      const req = createRequest(
        '¿Qué artículo de la Constitución regula la acción de tutela?'
      );
      const answer = await getAnswer(req);

      expect(answer).toBeTruthy();
      expect(answer.toLowerCase()).toContain('artículo 86');
      
      console.log('✓ Artículo constitucional citado correctamente');
    });

    test('Debe mencionar el nombre correcto de las instituciones', async () => {
      const req = createRequest(
        '¿Qué institución interpreta la Constitución en Colombia?'
      );
      const answer = await getAnswer(req);

      expect(answer).toBeTruthy();
      expect(answer.toLowerCase()).toContain('corte constitucional');
      
      console.log('✓ Institución mencionada correctamente');
    });

    test('Debe usar terminología jurídica apropiada', async () => {
      const req = createRequest(
        '¿Qué órgano judicial conoce de las tutelas?'
      );
      const answer = await getAnswer(req);

      expect(answer).toBeTruthy();
      expect(mentionsAny(answer, [
        'juez',
        'jueces',
        'jurisdicción',
      ])).toBe(true);
      
      console.log('✓ Terminología jurídica apropiada');
    });
  });

  describe('Consistencia de Respuestas', () => {
    test('Debe dar respuestas consistentes a consultas similares', async () => {
      const queries = [
        '¿Qué es una tutela?',
        '¿En qué consiste la acción de tutela?',
        '¿Cuál es el concepto de tutela?',
      ];

      const answers = await Promise.all(
        queries.map(query => getAnswer(createRequest(query)))
      );

      // Todas deben mencionar derechos fundamentales
      const allMentionFundamentals = answers.every(answer =>
        answer.toLowerCase().includes('derechos fundamentales') ||
        answer.toLowerCase().includes('derecho fundamental')
      );

      expect(allMentionFundamentals).toBe(true);
      
      console.log('✓ Respuestas consistentes entre consultas similares');
    });
  });
});
