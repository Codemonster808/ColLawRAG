#!/usr/bin/env node
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'

const RESULTS_PATH = path.join(process.cwd(), 'data', 'eval', 'complex-queries-results.json')

async function analyzeResults() {
  if (!fs.existsSync(RESULTS_PATH)) {
    console.error('❌ No se encontraron resultados. Ejecuta primero: node scripts/test-complex-queries.mjs')
    process.exit(1)
  }

  const content = await fsp.readFile(RESULTS_PATH, 'utf-8')
  const data = JSON.parse(content)
  const results = data.results || []

  console.log('='.repeat(80))
  console.log('📊 ANÁLISIS PROFUNDO DE CALIDAD DE CONSEJO LEGAL')
  console.log('='.repeat(80))
  console.log(`\n📅 Fecha de evaluación: ${new Date(data.timestamp).toLocaleString('es-CO')}`)
  console.log(`📋 Total de consultas analizadas: ${results.length}\n`)

  const successful = results.filter(r => !r.error)
  const failed = results.filter(r => r.error)

  // Análisis de estructura de consejo legal
  const adviceStructure = {
    hasProblemIdentification: 0,      // Identifica el problema legal
    hasLegalBasis: 0,                  // Menciona base legal
    hasActionableSteps: 0,             // Da pasos concretos
    hasRightsMention: 0,               // Menciona derechos específicos
    hasProcedureMention: 0,            // Menciona procedimientos
    hasWarning: 0,                      // Advierte sobre plazos/riesgos
    hasRecommendation: 0                // Recomienda acción específica
  }

  const qualityIssues = {
    vagueAdvice: [],                   // Consejos vagos
    missingSpecifics: [],             // Falta información específica
    incorrectCitations: [],            // Citas incorrectas
    noProcedure: []                    // No menciona procedimiento cuando debería
  }

  successful.forEach((result, idx) => {
    const answer = result.answer.toLowerCase()
    
    // Identificación de problema
    if (answer.includes('problema') || answer.includes('situación') || 
        answer.includes('caso') || answer.includes('derecho')) {
      adviceStructure.hasProblemIdentification++
    }
    
    // Base legal
    if (answer.includes('código') || answer.includes('ley') || 
        answer.includes('artículo') || answer.includes('constitución')) {
      adviceStructure.hasLegalBasis++
    }
    
    // Pasos accionables
    if (answer.includes('debe') || answer.includes('puede') || 
        answer.includes('debería') || answer.includes('pasos') ||
        answer.includes('procedimiento')) {
      adviceStructure.hasActionableSteps++
    }
    
    // Menciona derechos
    if (answer.includes('derecho') || answer.includes('derechos') ||
        answer.includes('tiene derecho') || answer.includes('puede reclamar')) {
      adviceStructure.hasRightsMention++
    }
    
    // Menciona procedimientos
    if (answer.includes('demanda') || answer.includes('tutela') ||
        answer.includes('reclamar') || answer.includes('presentar') ||
        answer.includes('ministerio') || answer.includes('juez')) {
      adviceStructure.hasProcedureMention++
    }
    
    // Advertencias
    if (answer.includes('plazo') || answer.includes('tiempo') ||
        answer.includes('importante') || answer.includes('recomendable')) {
      adviceStructure.hasWarning++
    }
    
    // Recomendaciones
    if (answer.includes('recomendable') || answer.includes('sugerimos') ||
        answer.includes('debe hacer') || answer.includes('es importante')) {
      adviceStructure.hasRecommendation++
    }

    // Detectar problemas de calidad
    if (answer.includes('puede ser') && answer.includes('consultar') && 
        !answer.includes('debe')) {
      qualityIssues.vagueAdvice.push({
        query: result.query.substring(0, 60),
        issue: 'Consejo demasiado vago'
      })
    }

    // Verificar citas fuera de rango
    const citationMatches = answer.match(/\[(\d+)\]/g) || []
    const maxCitation = Math.max(...citationMatches.map(m => parseInt(m.slice(1, -1))), 0)
    if (maxCitation > result.citations.length) {
      qualityIssues.incorrectCitations.push({
        query: result.query.substring(0, 60),
        maxCitation,
        available: result.citations.length
      })
    }

    // Verificar si falta información específica en casos complejos
    if (result.complexity === 'alta') {
      if (!answer.includes('abogado') && !answer.includes('asesoría')) {
        qualityIssues.missingSpecifics.push({
          query: result.query.substring(0, 60),
          issue: 'No recomienda asesoría legal en caso complejo'
        })
      }
    }
  })

  // Mostrar análisis
  console.log('📐 ESTRUCTURA DE CONSEJO LEGAL:')
  console.log('-'.repeat(80))
  Object.entries(adviceStructure).forEach(([key, count]) => {
    const percentage = (count / successful.length * 100).toFixed(1)
    const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())
    console.log(`   ${label}: ${count}/${successful.length} (${percentage}%)`)
  })

  console.log('\n⚠️  PROBLEMAS DE CALIDAD DETECTADOS:')
  console.log('-'.repeat(80))
  
  if (qualityIssues.vagueAdvice.length > 0) {
    console.log(`\n❌ Consejos vagos (${qualityIssues.vagueAdvice.length}):`)
    qualityIssues.vagueAdvice.forEach(issue => {
      console.log(`   - ${issue.query}...`)
      console.log(`     Problema: ${issue.issue}`)
    })
  }

  if (qualityIssues.incorrectCitations.length > 0) {
    console.log(`\n❌ Citas fuera de rango (${qualityIssues.incorrectCitations.length}):`)
    qualityIssues.incorrectCitations.forEach(issue => {
      console.log(`   - ${issue.query}...`)
      console.log(`     Cita máxima: [${issue.maxCitation}], Disponibles: ${issue.available}`)
    })
  }

  if (qualityIssues.missingSpecifics.length > 0) {
    console.log(`\n⚠️  Falta información específica (${qualityIssues.missingSpecifics.length}):`)
    qualityIssues.missingSpecifics.forEach(issue => {
      console.log(`   - ${issue.query}...`)
      console.log(`     Problema: ${issue.issue}`)
    })
  }

  if (Object.values(qualityIssues).every(arr => arr.length === 0)) {
    console.log('   ✅ No se detectaron problemas significativos')
  }

  // Calificación general
  console.log('\n' + '='.repeat(80))
  console.log('⭐ CALIFICACIÓN GENERAL DEL SISTEMA COMO ASESOR LEGAL')
  console.log('='.repeat(80))
  
  const structureScore = Object.values(adviceStructure).reduce((sum, val) => sum + val, 0) / 
                         (Object.keys(adviceStructure).length * successful.length) * 100
  
  const qualityScore = 100 - (
    qualityIssues.vagueAdvice.length * 5 +
    qualityIssues.incorrectCitations.length * 10 +
    qualityIssues.missingSpecifics.length * 3
  )
  
  const finalScore = (structureScore * 0.6 + qualityScore * 0.4)
  
  console.log(`\n📊 Puntuación de Estructura: ${structureScore.toFixed(1)}/100`)
  console.log(`📊 Puntuación de Calidad: ${Math.max(0, qualityScore).toFixed(1)}/100`)
  console.log(`\n⭐ PUNTUACIÓN FINAL: ${finalScore.toFixed(1)}/100`)
  
  if (finalScore >= 80) {
    console.log('   ✅ EXCELENTE: El sistema proporciona consejo legal de alta calidad')
  } else if (finalScore >= 60) {
    console.log('   ⚠️  BUENO: El sistema proporciona consejo útil pero puede mejorarse')
  } else {
    console.log('   ❌ NECESITA MEJORAS: El sistema requiere ajustes para dar consejo legal adecuado')
  }

  // Recomendaciones
  console.log('\n💡 RECOMENDACIONES DE MEJORA:')
  console.log('-'.repeat(80))
  
  if (adviceStructure.hasActionableSteps < successful.length * 0.8) {
    console.log('   1. Mejorar la especificidad de los pasos a seguir')
  }
  
  if (qualityIssues.incorrectCitations.length > 0) {
    console.log('   2. Corregir el prompt para evitar citas fuera de rango')
  }
  
  if (adviceStructure.hasWarning < successful.length * 0.7) {
    console.log('   3. Incluir más advertencias sobre plazos y riesgos legales')
  }
  
  if (qualityIssues.missingSpecifics.length > 0) {
    console.log('   4. Recomendar asesoría legal profesional en casos complejos')
  }

  console.log('\n✅ Análisis completado\n')
}

analyzeResults().catch(err => {
  console.error('❌ Error:', err)
  process.exit(1)
})

