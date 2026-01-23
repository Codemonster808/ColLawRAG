/**
 * Módulo de cálculos legales para prestaciones sociales, plazos, e indemnizaciones
 * Basado en la normativa laboral colombiana
 */

export interface CalculationResult {
  type: string
  amount: number
  formula: string
  breakdown: Record<string, number | string>
  notes: string[]
}

/**
 * Calcula cesantías según el Código Sustantivo del Trabajo
 * Artículo 249: Las cesantías equivalen a un mes de salario por cada año de servicio
 */
export function calculateCesantias(params: {
  salarioMensual: number
  mesesTrabajados: number
  interesesCesantias?: number // Porcentaje de intereses (default 12%)
}): CalculationResult {
  const { salarioMensual, mesesTrabajados, interesesCesantias = 12 } = params
  
  // Cesantías proporcionales
  const mesesAnuales = 12
  const cesantiasMensuales = salarioMensual / mesesAnuales
  const cesantiasProporcionales = cesantiasMensuales * mesesTrabajados
  
  // Intereses sobre cesantías (12% anual, proporcional)
  const interesesMensuales = (interesesCesantias / 100) / mesesAnuales
  const intereses = cesantiasProporcionales * interesesMensuales * mesesTrabajados
  
  const total = cesantiasProporcionales + intereses
  
  return {
    type: 'cesantias',
    amount: Math.round(total),
    formula: `Cesantías = (Salario / 12) × Meses + Intereses (${interesesCesantias}% anual)`,
    breakdown: {
      salarioMensual,
      mesesTrabajados,
      cesantiasProporcionales: Math.round(cesantiasProporcionales),
      intereses: Math.round(intereses),
      total: Math.round(total)
    },
    notes: [
      'Las cesantías se liquidan proporcionalmente por meses trabajados',
      `Los intereses se calculan al ${interesesCesantias}% anual sobre las cesantías`,
      'Este cálculo es aproximado. Consulta con un contador o abogado laboral para liquidación exacta'
    ]
  }
}

/**
 * Calcula vacaciones según el Código Sustantivo del Trabajo
 * Artículo 186: 15 días hábiles de vacaciones por cada año de servicio
 */
export function calculateVacaciones(params: {
  salarioMensual: number
  diasTrabajados: number
}): CalculationResult {
  const { salarioMensual, diasTrabajados } = params
  
  // Días de vacaciones proporcionales (15 días por año = 360 días trabajados)
  const diasVacaciones = (15 / 360) * diasTrabajados
  const valorDiaVacacion = salarioMensual / 30
  const totalVacaciones = diasVacaciones * valorDiaVacacion
  
  return {
    type: 'vacaciones',
    amount: Math.round(totalVacaciones),
    formula: 'Vacaciones = (15 días / 360 días) × Días trabajados × (Salario / 30)',
    breakdown: {
      salarioMensual,
      diasTrabajados,
      diasVacacionesProporcionales: Math.round(diasVacaciones * 10) / 10,
      valorDiaVacacion: Math.round(valorDiaVacacion),
      total: Math.round(totalVacaciones)
    },
    notes: [
      'Las vacaciones se calculan proporcionalmente: 15 días por cada año completo (360 días)',
      'Los días de vacaciones son hábiles (no incluyen domingos ni festivos)',
      'Si no has disfrutado las vacaciones, tienes derecho al pago proporcional'
    ]
  }
}

/**
 * Calcula prima de servicios según el Código Sustantivo del Trabajo
 * Artículo 306: Prima de servicios equivalente a un mes de salario por año
 */
export function calculatePrimaServicios(params: {
  salarioMensual: number
  mesesTrabajados: number
}): CalculationResult {
  const { salarioMensual, mesesTrabajados } = params
  
  // Prima proporcional (se paga en dos pagos: mitad en junio, mitad en diciembre)
  const primaMensual = salarioMensual / 12
  const primaProporcional = primaMensual * mesesTrabajados
  
  return {
    type: 'prima_servicios',
    amount: Math.round(primaProporcional),
    formula: 'Prima de Servicios = (Salario / 12) × Meses trabajados',
    breakdown: {
      salarioMensual,
      mesesTrabajados,
      primaMensual: Math.round(primaMensual),
      primaProporcional: Math.round(primaProporcional)
    },
    notes: [
      'La prima de servicios se paga en dos pagos: mitad en junio y mitad en diciembre',
      'Se calcula proporcionalmente por meses trabajados',
      'Es un derecho irrenunciable del trabajador'
    ]
  }
}

/**
 * Calcula indemnización por despido sin justa causa
 * Artículo 64 del CST: Indemnización según años de servicio
 */
export function calculateIndemnizacionDespido(params: {
  salarioMensual: number
  anosTrabajados: number
  mesesAdicionales?: number
}): CalculationResult {
  const { salarioMensual, anosTrabajados, mesesAdicionales = 0 } = params
  
  let indemnizacion = 0
  const anosCompletos = Math.floor(anosTrabajados)
  const mesesTotales = anosTrabajados * 12 + mesesAdicionales
  
  // Primer año: 30 días
  if (anosCompletos >= 1) {
    indemnizacion += 30 * (salarioMensual / 30)
  }
  
  // Años siguientes: 20 días por cada año adicional
  if (anosCompletos > 1) {
    const anosAdicionales = anosCompletos - 1
    indemnizacion += anosAdicionales * 20 * (salarioMensual / 30)
  }
  
  // Proporcional por meses adicionales del último año
  if (mesesAdicionales > 0 && anosCompletos >= 1) {
    const diasProporcionales = (mesesAdicionales / 12) * 20
    indemnizacion += diasProporcionales * (salarioMensual / 30)
  }
  
  return {
    type: 'indemnizacion_despido',
    amount: Math.round(indemnizacion),
    formula: 'Indemnización = 30 días (primer año) + 20 días × años adicionales + proporcional',
    breakdown: {
      salarioMensual,
      anosTrabajados: anosCompletos,
      mesesAdicionales,
      diasIndemnizacion: Math.round(indemnizacion / (salarioMensual / 30)),
      total: Math.round(indemnizacion)
    },
    notes: [
      'Primer año de servicio: 30 días de salario',
      'Años siguientes: 20 días por cada año adicional',
      'Se calcula proporcionalmente por meses adicionales',
      'Solo aplica para despido sin justa causa'
    ]
  }
}

/**
 * Calcula recargo por horas extras
 * Artículo 159 del CST: 25% recargo sobre salario ordinario diurno
 */
export function calculateHorasExtras(params: {
  salarioMensual: number
  horasExtras: number
  recargoPorcentaje?: number // Default 25%
}): CalculationResult {
  const { salarioMensual, horasExtras, recargoPorcentaje = 25 } = params
  
  const valorHoraOrdinaria = (salarioMensual / 30) / 8 // Asumiendo 8 horas diarias
  const recargo = recargoPorcentaje / 100
  const valorHoraExtra = valorHoraOrdinaria * (1 + recargo)
  const totalHorasExtras = horasExtras * valorHoraExtra
  
  return {
    type: 'horas_extras',
    amount: Math.round(totalHorasExtras),
    formula: `Horas Extras = Horas × (Valor Hora × (1 + ${recargoPorcentaje}%))`,
    breakdown: {
      salarioMensual,
      horasExtras,
      valorHoraOrdinaria: Math.round(valorHoraOrdinaria),
      recargoPorcentaje,
      valorHoraExtra: Math.round(valorHoraExtra),
      total: Math.round(totalHorasExtras)
    },
    notes: [
      `Recargo del ${recargoPorcentaje}% sobre el salario ordinario diurno`,
      'Las horas extras deben ser autorizadas previamente por el empleador',
      'Máximo 2 horas extras por día según el Código Sustantivo del Trabajo'
    ]
  }
}

/**
 * Calcula recargo dominical y festivo
 * Artículo 179 del CST: Recargo del 75% sobre salario ordinario
 */
export function calculateRecargoDominical(params: {
  salarioMensual: number
  horasDominicales: number
  recargoPorcentaje?: number // Default 75%
}): CalculationResult {
  const { salarioMensual, horasDominicales, recargoPorcentaje = 75 } = params
  
  const valorHoraOrdinaria = (salarioMensual / 30) / 8
  const recargo = recargoPorcentaje / 100
  const valorHoraDominical = valorHoraOrdinaria * (1 + recargo)
  const totalDominical = horasDominicales * valorHoraDominical
  
  return {
    type: 'recargo_dominical',
    amount: Math.round(totalDominical),
    formula: `Recargo Dominical = Horas × (Valor Hora × (1 + ${recargoPorcentaje}%))`,
    breakdown: {
      salarioMensual,
      horasDominicales,
      valorHoraOrdinaria: Math.round(valorHoraOrdinaria),
      recargoPorcentaje,
      valorHoraDominical: Math.round(valorHoraDominical),
      total: Math.round(totalDominical)
    },
    notes: [
      `Recargo del ${recargoPorcentaje}% sobre el salario ordinario por trabajo en domingo o festivo`,
      'Aplica tanto para trabajo en domingo como en días festivos',
      'Si el dominical es día de descanso compensatorio, no aplica recargo adicional'
    ]
  }
}

/**
 * Calcula el plazo de prescripción para acciones laborales
 * Generalmente 3 años según el Código Sustantivo del Trabajo
 */
export function calculatePlazoPrescripcion(params: {
  fechaInicio: Date
  tipoAccion: 'prestaciones' | 'indemnizacion' | 'horas_extras' | 'general'
}): CalculationResult {
  const { fechaInicio, tipoAccion } = params
  
  // Plazos según tipo de acción (en años)
  const plazos: Record<string, number> = {
    prestaciones: 3,
    indemnizacion: 3,
    horas_extras: 3,
    general: 3
  }
  
  const plazoAnos = plazos[tipoAccion] || 3
  const fechaFin = new Date(fechaInicio)
  fechaFin.setFullYear(fechaFin.getFullYear() + plazoAnos)
  
  const hoy = new Date()
  const diasRestantes = Math.ceil((fechaFin.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
  const haPrescrito = diasRestantes < 0
  
  return {
    type: 'plazo_prescripcion',
    amount: diasRestantes,
    formula: `Plazo de prescripción: ${plazoAnos} años desde ${fechaInicio.toLocaleDateString('es-CO')}`,
    breakdown: {
      plazoAnos,
      fechaInicio: fechaInicio.toISOString(),
      fechaFin: fechaFin.toISOString(),
      diasRestantes: haPrescrito ? 0 : diasRestantes,
      haPrescrito: haPrescrito ? 1 : 0
    },
    notes: [
      `El plazo de prescripción para acciones laborales es de ${plazoAnos} años`,
      haPrescrito 
        ? '⚠️ ADVERTENCIA: El plazo de prescripción ya venció. Consulta con un abogado urgentemente.'
        : `Tienes ${Math.max(0, diasRestantes)} días restantes para ejercer tu acción`,
      'Los plazos pueden variar según el tipo específico de acción. Consulta con un abogado laboral.'
    ]
  }
}

/**
 * Calcula todas las prestaciones sociales de un trabajador
 */
export function calculateAllPrestaciones(params: {
  salarioMensual: number
  mesesTrabajados: number
  diasTrabajados: number
  interesesCesantias?: number
}): {
  cesantias: CalculationResult
  vacaciones: CalculationResult
  primaServicios: CalculationResult
  total: number
} {
  const cesantias = calculateCesantias({
    salarioMensual: params.salarioMensual,
    mesesTrabajados: params.mesesTrabajados,
    interesesCesantias: params.interesesCesantias
  })
  
  const vacaciones = calculateVacaciones({
    salarioMensual: params.salarioMensual,
    diasTrabajados: params.diasTrabajados
  })
  
  const primaServicios = calculatePrimaServicios({
    salarioMensual: params.salarioMensual,
    mesesTrabajados: params.mesesTrabajados
  })
  
  const total = cesantias.amount + vacaciones.amount + primaServicios.amount
  
  return {
    cesantias,
    vacaciones,
    primaServicios,
    total
  }
}

