#!/usr/bin/env npx tsx

/**
 * Script CLI para gestionar vigencia de normas legales
 *
 * Comandos:
 * - consultar <normaId> [fecha]         Consulta estado de vigencia
 * - crear <normaId> <nombre> <tipo> <vigenteDesde>    Crea nueva norma
 * - derogar <normaId> <derogadaPor> <fecha>           Deroga totalmente
 * - derogar-parcial <normaId> <derogadaPor> <articulo> <fecha> [razon]
 * - modificar <normaId> <modificadaPor> <fecha> <tipo> [descripcion]
 * - listar [vigente|derogada|parcialmente_derogada]   Lista normas por estado
 * - reporte <normaId>                   Genera reporte de vigencia
 */

import {
  consultarVigencia,
  crearNorma,
  registrarDerogacionTotal,
  registrarDerogacionParcial,
  registrarModificacion,
  filtrarPorEstado,
  generarReporte,
  listNormas,
  loadNorma
} from '../lib/norm-vigencia'

const args = process.argv.slice(2)
const command = args[0]

if (!command) {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║   Sistema de Gestión de Vigencia de Normas Legales       ║
╚═══════════════════════════════════════════════════════════╝

Uso: npx tsx scripts/vigencia-normas.ts <comando> [argumentos]

Comandos disponibles:

  📋 Consultar vigencia:
    consultar <normaId> [fecha]
    Ejemplo: consultar ley-100-1993 2024-01-15

  ➕ Crear norma:
    crear <normaId> <nombre> <tipo> <vigenteDesde>
    Ejemplo: crear ley-100-1993 "Ley 100 de 1993" ley 1993-12-23

  ❌ Derogar totalmente:
    derogar <normaId> <derogadaPor> <fecha>
    Ejemplo: derogar ley-50-1990 ley-789-2002 2002-12-27

  ⚠️  Derogar parcialmente:
    derogar-parcial <normaId> <derogadaPor> <articulo> <fecha> [razon]
    Ejemplo: derogar-parcial ley-100-1993 ley-797-2003 "Art. 5" 2003-01-29

  📝 Registrar modificación:
    modificar <normaId> <modificadaPor> <fecha> <tipo> [descripcion]
    Tipos: modificacion, adicion, subrogacion, aclaracion
    Ejemplo: modificar ley-100-1993 ley-797-2003 2003-01-29 modificacion

  📚 Listar normas:
    listar [vigente|derogada|parcialmente_derogada] [fecha]
    Ejemplo: listar vigente 2024-01-01

  📊 Generar reporte:
    reporte <normaId>
    Ejemplo: reporte ley-100-1993

  🗂️  Ver todas:
    todas
    Lista todas las normas en el sistema

╚═══════════════════════════════════════════════════════════╝
  `)
  process.exit(0)
}

try {
  switch (command) {
    case 'consultar': {
      const [, normaId, fecha] = args
      if (!normaId) {
        console.error('❌ Error: Debes especificar el ID de la norma')
        process.exit(1)
      }

      const vigencia = consultarVigencia(normaId, fecha)

      if (!vigencia) {
        console.error(`❌ Norma ${normaId} no encontrada`)
        process.exit(1)
      }

      const fechaConsulta = fecha || new Date().toISOString().split('T')[0]
      console.log(`\n📅 Consulta de vigencia: ${normaId}`)
      console.log(`   Fecha: ${fechaConsulta}\n`)

      if (vigencia.estado === 'vigente') {
        console.log('✅ Estado: VIGENTE')
      } else if (vigencia.estado === 'derogada') {
        console.log('❌ Estado: DEROGADA')
        if ('derogadaPor' in vigencia && vigencia.derogadaPor) {
          console.log(`   Derogada por: ${vigencia.derogadaPor}`)
        }
        if ('derogadaDesde' in vigencia && vigencia.derogadaDesde) {
          console.log(`   Desde: ${vigencia.derogadaDesde}`)
        }
      } else if (vigencia.estado === 'parcialmente_derogada') {
        console.log('⚠️  Estado: PARCIALMENTE DEROGADA')
        if ('derogaciones' in vigencia) {
          console.log('\n   Artículos derogados:')
          vigencia.derogaciones.forEach((der: { articulo?: string; derogadoPor: string; derogadaDesde: string; razon?: string }) => {
            console.log(`   • ${der.articulo || 'Sección'}`)
            console.log(`     Derogada por: ${der.derogadoPor}`)
            console.log(`     Desde: ${der.derogadaDesde}`)
            if (der.razon) {
              console.log(`     Razón: ${der.razon}`)
            }
          })
        }
      }
      console.log('')
      break
    }

    case 'crear': {
      const [, normaId, nombre, tipo, vigenteDesde] = args
      if (!normaId || !nombre || !tipo || !vigenteDesde) {
        console.error('❌ Error: Faltan argumentos')
        console.error('   Uso: crear <normaId> <nombre> <tipo> <vigenteDesde>')
        process.exit(1)
      }

      const tiposValidos = ['ley', 'decreto', 'acto_legislativo', 'codigo', 'resolucion', 'acuerdo'] as const
      if (!tiposValidos.includes(tipo as any)) {
        console.error(`❌ Error: Tipo inválido. Debe ser uno de: ${tiposValidos.join(', ')}`)
        process.exit(1)
      }

      crearNorma({
        normaId,
        nombre,
        tipo: tipo as 'ley' | 'decreto' | 'acto_legislativo' | 'codigo' | 'resolucion' | 'acuerdo',
        vigenteDesde,
        vigenteHasta: null,
        estado: 'vigente'
      })

      console.log(`✅ Norma ${normaId} creada exitosamente`)
      break
    }

    case 'derogar': {
      const [, normaId, derogadaPor, fecha] = args
      if (!normaId || !derogadaPor || !fecha) {
        console.error('❌ Error: Faltan argumentos')
        console.error('   Uso: derogar <normaId> <derogadaPor> <fecha>')
        process.exit(1)
      }

      registrarDerogacionTotal(normaId, derogadaPor, fecha)
      console.log(`✅ Norma ${normaId} derogada totalmente por ${derogadaPor} desde ${fecha}`)
      break
    }

    case 'derogar-parcial': {
      const [, normaId, derogadaPor, articulo, fecha, ...razonParts] = args
      if (!normaId || !derogadaPor || !articulo || !fecha) {
        console.error('❌ Error: Faltan argumentos')
        console.error('   Uso: derogar-parcial <normaId> <derogadaPor> <articulo> <fecha> [razon]')
        process.exit(1)
      }

      const razon = razonParts.join(' ') || undefined

      registrarDerogacionParcial(normaId, {
        articulo,
        derogadoPor: derogadaPor,
        derogadaDesde: fecha,
        razon
      })

      console.log(`✅ Derogación parcial registrada:`)
      console.log(`   Norma: ${normaId}`)
      console.log(`   Artículo: ${articulo}`)
      console.log(`   Derogada por: ${derogadaPor}`)
      console.log(`   Desde: ${fecha}`)
      if (razon) {
        console.log(`   Razón: ${razon}`)
      }
      break
    }

    case 'modificar': {
      const [, normaId, modificadaPor, fecha, tipo, ...descripcionParts] = args
      if (!normaId || !modificadaPor || !fecha || !tipo) {
        console.error('❌ Error: Faltan argumentos')
        console.error('   Uso: modificar <normaId> <modificadaPor> <fecha> <tipo> [descripcion]')
        process.exit(1)
      }

      const tiposValidos = ['modificacion', 'adicion', 'subrogacion', 'aclaracion'] as const
      if (!tiposValidos.includes(tipo as any)) {
        console.error(`❌ Error: Tipo inválido. Debe ser uno de: ${tiposValidos.join(', ')}`)
        process.exit(1)
      }

      const descripcion = descripcionParts.join(' ') || undefined

      registrarModificacion(normaId, {
        norma: modificadaPor,
        fecha,
        tipo: tipo as 'modificacion' | 'adicion' | 'subrogacion' | 'aclaracion',
        descripcion
      })

      console.log(`✅ Modificación registrada:`)
      console.log(`   Norma: ${normaId}`)
      console.log(`   Modificada por: ${modificadaPor}`)
      console.log(`   Fecha: ${fecha}`)
      console.log(`   Tipo: ${tipo}`)
      if (descripcion) {
        console.log(`   Descripción: ${descripcion}`)
      }
      break
    }

    case 'listar': {
      const [, estado, fecha] = args

      const estadosValidos = ['vigente', 'derogada', 'parcialmente_derogada'] as const
      if (estado && !estadosValidos.includes(estado as any)) {
        console.error('❌ Error: Estado inválido. Debe ser: vigente, derogada o parcialmente_derogada')
        process.exit(1)
      }

      let normas: string[]
      if (estado) {
        normas = filtrarPorEstado(estado as 'vigente' | 'derogada' | 'parcialmente_derogada', fecha)
      } else {
        normas = listNormas()
      }

      const fechaConsulta = fecha || new Date().toISOString().split('T')[0]

      console.log(`\n📚 Listado de normas`)
      if (estado) {
        console.log(`   Estado: ${estado}`)
      }
      console.log(`   Fecha: ${fechaConsulta}`)
      console.log(`   Total: ${normas.length}\n`)

      if (normas.length === 0) {
        console.log('   (No hay normas que mostrar)\n')
      } else {
        normas.forEach((normaId, index) => {
          const norma = loadNorma(normaId)
          if (norma) {
            const vigencia = consultarVigencia(normaId, fecha)
            let icono = '✅'
            if (vigencia?.estado === 'derogada') icono = '❌'
            if (vigencia?.estado === 'parcialmente_derogada') icono = '⚠️'

            console.log(`   ${index + 1}. ${icono} ${norma.nombre} (${normaId})`)
          }
        })
        console.log('')
      }
      break
    }

    case 'reporte': {
      const [, normaId] = args
      if (!normaId) {
        console.error('❌ Error: Debes especificar el ID de la norma')
        process.exit(1)
      }

      const reporte = generarReporte(normaId)
      console.log(reporte)
      break
    }

    case 'todas': {
      const normas = listNormas()

      console.log(`\n📚 Todas las normas en el sistema (${normas.length})\n`)

      normas.forEach((normaId, index) => {
        const norma = loadNorma(normaId)
        if (norma) {
          const vigencia = consultarVigencia(normaId)
          let icono = '✅'
          if (vigencia?.estado === 'derogada') icono = '❌'
          if (vigencia?.estado === 'parcialmente_derogada') icono = '⚠️'

          console.log(`   ${index + 1}. ${icono} ${norma.nombre}`)
          console.log(`      ID: ${normaId}`)
          console.log(`      Tipo: ${norma.tipo}`)
          console.log(`      Vigente desde: ${norma.vigenteDesde}`)
          if (norma.vigenteHasta) {
            console.log(`      Vigente hasta: ${norma.vigenteHasta}`)
          }
          console.log('')
        }
      })
      break
    }

    default:
      console.error(`❌ Comando desconocido: ${command}`)
      console.error('   Ejecuta sin argumentos para ver la ayuda')
      process.exit(1)
  }
} catch (error) {
  const err = error as Error
  console.error(`\n❌ Error: ${err.message}\n`)
  process.exit(1)
}
