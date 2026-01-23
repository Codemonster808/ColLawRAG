#!/usr/bin/env node
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'

const REPORT_PATH = path.join(process.cwd(), 'data', 'eval', 'quality-report.json')
const REPORT_TXT_PATH = path.join(process.cwd(), 'data', 'eval', 'quality-report.txt')

async function main() {
  if (!fs.existsSync(REPORT_PATH)) {
    console.error('❌ No se encontró el reporte de calidad. Ejecuta primero: npm run evaluate')
    process.exit(1)
  }

  const reportContent = await fsp.readFile(REPORT_PATH, 'utf-8')
  const report = JSON.parse(reportContent)

  if (fs.existsSync(REPORT_TXT_PATH)) {
    const txtContent = await fsp.readFile(REPORT_TXT_PATH, 'utf-8')
    console.log(txtContent)
  } else {
    // Generar reporte básico desde JSON
    console.log('='.repeat(60))
    console.log('REPORTE DE EVALUACIÓN DE CALIDAD DE CITAS')
    console.log('='.repeat(60))
    console.log(`Fecha: ${new Date(report.timestamp).toLocaleString('es-CO')}`)
    console.log('')
    console.log('RESUMEN GENERAL')
    console.log('-'.repeat(60))
    console.log(`Total de consultas: ${report.summary.totalQueries}`)
    console.log(`Consultas exitosas: ${report.summary.successfulQueries}`)
    console.log(`Precisión promedio: ${(report.summary.overallPrecision * 100).toFixed(1)}%`)
    console.log(`Citas válidas: ${report.summary.totalValidCitations}/${report.summary.totalCitations}`)
    console.log(`Precisión de citas: ${(report.summary.citationPrecision * 100).toFixed(1)}%`)
  }
}

main().catch(err => {
  console.error('❌ Error:', err)
  process.exit(1)
})

