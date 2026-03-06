import { describe, it, expect } from '@jest/globals'
import { validateHNACStructure, generateHNACErrorFeedback, extractHNACSections } from '../lib/hnac-validator'

describe('HNAC Validator', () => {
  describe('validateHNACStructure', () => {
    it('should validate a correctly structured HNAC response', () => {
      const answer = `**HECHOS RELEVANTES:**
El trabajador fue despedido sin justa causa después de 5 años de servicio.

**NORMAS APLICABLES:**
Según el Código Sustantivo del Trabajo, artículo 65 [1], el despido sin justa causa genera derecho a indemnización.

**ANÁLISIS JURÍDICO:**
Aplicando la norma citada, el trabajador tiene derecho a recibir indemnización equivalente a 30 días de salario por cada año de servicio.

**CONCLUSIÓN:**
El trabajador tiene derecho a recibir 150 días de salario como indemnización por despido sin justa causa.

**RECOMENDACIÓN:**
Presentar demanda laboral dentro del término de prescripción de 3 años.`

      const result = validateHNACStructure(answer)
      
      expect(result.isValid).toBe(true)
      expect(result.missingSections).toHaveLength(0)
      expect(result.structure.hechos).toBeDefined()
      expect(result.structure.normas).toBeDefined()
      expect(result.structure.analisis).toBeDefined()
      expect(result.structure.conclusion).toBeDefined()
      expect(result.structure.recomendacion).toBeDefined()
      expect(result.score).toBeGreaterThanOrEqual(50) // Score mínimo para estructura válida
    })

    it('should detect missing sections', () => {
      const answer = `El trabajador fue despedido. Tiene derecho a indemnización.`
      
      const result = validateHNACStructure(answer)
      
      expect(result.isValid).toBe(false)
      expect(result.missingSections.length).toBeGreaterThan(0)
      expect(result.score).toBeLessThan(70)
    })

    it('should extract sections with different formats', () => {
      const answer = `**HECHOS RELEVANTES:**
Situación específica del caso con suficiente detalle para cumplir el mínimo requerido.

**NORMAS APLICABLES:**
Ley 50 de 1990 [1] con referencias específicas y detalles adicionales.

**ANÁLISIS JURÍDICO:**
Aplicación de la norma a los hechos con análisis detallado y completo.

**CONCLUSIÓN:**
Conclusión jurídica clara y fundamentada con suficiente contenido.`

      const result = validateHNACStructure(answer)
      
      expect(result.structure.hechos).toBeDefined()
      expect(result.structure.normas).toBeDefined()
      expect(result.structure.analisis).toBeDefined()
      expect(result.structure.conclusion).toBeDefined()
    })

    it('should calculate quality score correctly', () => {
      const completeAnswer = `**HECHOS RELEVANTES:**
Hechos detallados del caso con suficiente información.

**NORMAS APLICABLES:**
Normas con citas [1], [2], [3] y referencias específicas.

**ANÁLISIS JURÍDICO:**
Análisis detallado y completo de la aplicación de las normas a los hechos específicos del caso.

**CONCLUSIÓN:**
Conclusión jurídica clara y fundamentada.

**RECOMENDACIÓN:**
Pasos concretos a seguir.`

      const result = validateHNACStructure(completeAnswer)
      
      expect(result.score).toBeGreaterThanOrEqual(70) // Score mínimo para calidad buena
      expect(['excelente', 'buena']).toContain(result.quality)
    })
  })

  describe('generateHNACErrorFeedback', () => {
    it('should generate feedback for missing sections', () => {
      const validation = validateHNACStructure('Respuesta incompleta sin estructura.')
      const feedback = generateHNACErrorFeedback(validation)
      
      expect(feedback).toContain('FALTAN SECCIONES REQUERIDAS')
      expect(feedback).toContain('FORMATO REQUERIDO')
    })
  })

  describe('extractHNACSections', () => {
    it('should extract sections from unstructured text', () => {
      const unstructured = `Primer párrafo con hechos del caso y suficiente información para cumplir el mínimo requerido de caracteres.

Segundo párrafo con normas aplicables [1], [2] y referencias específicas a artículos y leyes relevantes.

Tercer párrafo con análisis jurídico detallado y completo que aplica las normas a los hechos específicos del caso con suficiente profundidad.

Último párrafo con conclusión jurídica clara y fundamentada con suficiente contenido para ser válida.`

      const result = extractHNACSections(unstructured)
      
      // El fallback debería extraer al menos algunas secciones
      expect(result.hechos || result.analisis || result.conclusion).toBeDefined()
      // Si tiene análisis, debería tenerlo definido
      if (result.analisis) {
        expect(result.analisis.length).toBeGreaterThan(0)
      }
    })
  })
})
