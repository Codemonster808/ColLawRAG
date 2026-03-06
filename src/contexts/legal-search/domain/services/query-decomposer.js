/**
 * Query Decomposer - Detecta y descompone consultas multi-parte
 *
 * Identifica si una consulta del usuario contiene múltiples preguntas o temas
 * y analiza su complejidad.
 *
 * Ejemplos de consultas multi-parte:
 * - "¿Cuáles son los requisitos para la acción de tutela y cuánto tiempo tarda?"
 * - "Explícame la acción de cumplimiento y también la acción de grupo"
 * - "Compara el proceso laboral ordinario con el verbal"
 *
 * @module query-decomposer
 * @created 2026-02-10
 * @version 1.0.0
 */
/**
 * Patrones para detectar consultas multi-parte
 */
const MULTI_PART_PATTERNS = {
    // Conjunciones que separan preguntas
    conjunctions: [
        { pattern: /\s+y\s+(?:además|también|igualmente)/gi, weight: 0.9 },
        { pattern: /\s+y\s+(?:cuál|cuáles|qué|cómo|cuándo|cuánto|cuánta|cuántos|cuántas|dónde|por qué|para qué)/gi, weight: 0.95 },
        { pattern: /\s+además\s+/gi, weight: 0.8 },
        { pattern: /\s+también\s+/gi, weight: 0.75 },
        { pattern: /\s+asimismo\s+/gi, weight: 0.8 },
        { pattern: /\s+igualmente\s+/gi, weight: 0.8 },
        { pattern: /\s+por\s+otro\s+lado\s+/gi, weight: 0.9 },
        { pattern: /\s+por\s+otra\s+parte\s+/gi, weight: 0.9 },
        { pattern: /\s+adicionalmente\s+/gi, weight: 0.85 },
        { pattern: /;/g, weight: 0.7 }, // Punto y coma como separador
    ],
    // Palabras interrogativas que indican múltiples preguntas
    questions: [
        { pattern: /\?[^?]*\?/g, weight: 1.0 }, // Dos o más signos de interrogación
        { pattern: /(?:cuál|cuáles|qué|cómo|cuándo|cuánto|cuánta|cuántos|cuántas|dónde|por qué|para qué)/gi, weight: 0.6 },
    ],
    // Comparaciones explícitas
    comparisons: [
        { pattern: /\b(?:compar[ao]|diferencia|vs\.?|versus|entre)\b/gi, weight: 0.95 },
        { pattern: /\b(?:a\s+diferencia\s+de|en\s+contraste\s+con|en\s+comparación\s+con)\b/gi, weight: 0.9 },
        { pattern: /\b(?:mejor|peor|más|menos)\s+(?:que|de)\b/gi, weight: 0.7 },
    ],
    // Enumeraciones
    enumerations: [
        { pattern: /\b(?:primer[ao]|segund[ao]|tercer[ao]|cuart[ao])\b/gi, weight: 0.8 },
        { pattern: /\b(?:\d+[\.\)]\s+)/g, weight: 0.9 }, // "1. ", "2) ", etc.
        { pattern: /\b(?:[a-z][\.\)]\s+)/g, weight: 0.7 }, // "a. ", "b) ", etc.
    ],
};
/**
 * Temas legales comunes (para detectar cambios de tema)
 */
const LEGAL_THEMES = [
    'tutela', 'acción de tutela',
    'cumplimiento', 'acción de cumplimiento',
    'grupo', 'acción de grupo', 'acción popular',
    'laboral', 'despido', 'liquidación',
    'pensión', 'jubilación',
    'salario', 'prestaciones',
    'contrato', 'incumplimiento',
    'daños', 'perjuicios', 'indemnización',
    'divorcio', 'custodia', 'alimentos',
    'penal', 'delito', 'condena',
    'civil', 'comercial', 'administrativo',
    'ejecutivo', 'declarativo',
    'sentencia', 'fallo', 'providencia',
];
/**
 * Detecta indicadores de múltiples partes en la consulta
 */
function detectIndicators(query) {
    const indicators = [];
    const lowerQuery = query.toLowerCase();
    // Detectar conjunciones
    for (const { pattern, weight } of MULTI_PART_PATTERNS.conjunctions) {
        const matches = [...query.matchAll(pattern)];
        for (const match of matches) {
            if (match.index !== undefined) {
                indicators.push({
                    type: 'conjunction',
                    position: match.index,
                    match: match[0],
                    confidence: weight,
                });
            }
        }
    }
    // Detectar múltiples preguntas
    const questionWords = query.match(/(?:cuál|cuáles|qué|cómo|cuándo|cuánto|cuánta|cuántos|cuántas|dónde|por qué|para qué)/gi) || [];
    const questionMarks = (query.match(/\?/g) || []).length;
    // Si hay 2+ signos de interrogación, muy probable que sean preguntas múltiples
    if (questionMarks >= 2) {
        indicators.push({
            type: 'question',
            position: 0,
            match: `${questionMarks} preguntas (signos de interrogación)`,
            confidence: 0.95,
        });
    }
    else if (questionWords.length > 1) {
        // Si hay múltiples palabras interrogativas pero solo 1 signo de interrogación
        indicators.push({
            type: 'question',
            position: 0,
            match: `${questionWords.length} palabras interrogativas`,
            confidence: Math.min(0.6 + (questionWords.length - 1) * 0.2, 1.0),
        });
    }
    // Detectar comparaciones
    for (const { pattern, weight } of MULTI_PART_PATTERNS.comparisons) {
        const matches = [...query.matchAll(pattern)];
        for (const match of matches) {
            if (match.index !== undefined) {
                indicators.push({
                    type: 'comparative',
                    position: match.index,
                    match: match[0],
                    confidence: weight,
                });
            }
        }
    }
    // Detectar enumeraciones
    for (const { pattern, weight } of MULTI_PART_PATTERNS.enumerations) {
        const matches = [...query.matchAll(pattern)];
        if (matches.length >= 2) { // Mínimo 2 items enumerados
            for (const match of matches) {
                if (match.index !== undefined) {
                    indicators.push({
                        type: 'enumeration',
                        position: match.index,
                        match: match[0],
                        confidence: weight,
                    });
                }
            }
        }
    }
    // Detectar cambios de tema legal (solo si hay MÁS de un tema)
    const themesFound = LEGAL_THEMES.filter(theme => lowerQuery.includes(theme));
    if (themesFound.length > 1) {
        // Verificar que los temas están en partes diferentes de la consulta
        const positions = themesFound.map(theme => lowerQuery.indexOf(theme));
        const spread = Math.max(...positions) - Math.min(...positions);
        if (spread > 20) { // Temas están separados por al menos 20 caracteres
            indicators.push({
                type: 'theme',
                position: 0,
                match: `${themesFound.length} temas: ${themesFound.join(', ')}`,
                confidence: 0.8,
            });
        }
    }
    // Ordenar por posición
    return indicators.sort((a, b) => a.position - b.position);
}
/**
 * Divide la consulta en partes basándose en los indicadores detectados
 */
function splitIntoParts(query, indicators) {
    if (indicators.length === 0) {
        return [query.trim()];
    }
    const parts = [];
    let currentStart = 0;
    // Encontrar los puntos de división más confiables
    const splitPoints = indicators
        .filter(ind => ind.confidence >= 0.75 && (ind.type === 'conjunction' || ind.type === 'enumeration'))
        .map(ind => ind.position)
        .sort((a, b) => a - b);
    // Si hay conjunciones "y + palabra interrogativa", dividir ahí
    if (splitPoints.length > 0 && indicators.some(ind => ind.type === 'conjunction' && ind.confidence >= 0.9)) {
        // Dividir por conjunciones fuertes
        for (let i = 0; i < splitPoints.length; i++) {
            const splitPos = splitPoints[i];
            const part = query.substring(currentStart, splitPos).trim();
            if (part.length > 10) { // Mínimo 10 caracteres por parte
                parts.push(part);
            }
            currentStart = splitPos;
        }
        // Agregar la última parte
        const lastPart = query.substring(currentStart).trim();
        if (lastPart.length > 10) {
            parts.push(lastPart);
        }
        return parts.filter(p => p.length > 0);
    }
    // Si hay comparaciones, dividir en dos partes (A vs B)
    const hasComparison = indicators.some(ind => ind.type === 'comparative');
    if (hasComparison) {
        const compPattern = /\b(?:compar[ao]|diferencia|vs\.?|versus|entre)\b/gi;
        const match = compPattern.exec(query);
        if (match && match.index !== undefined) {
            const beforeComp = query.substring(0, match.index).trim();
            const afterComp = query.substring(match.index + match[0].length).trim();
            // Intentar identificar las dos entidades comparadas
            const entities = afterComp.split(/\s+y\s+/gi);
            if (entities.length >= 2) {
                parts.push(`${beforeComp} ${entities[0].trim()}`);
                parts.push(`${beforeComp} ${entities[1].trim()}`);
                return parts.filter(p => p.length > 0);
            }
        }
    }
    // División por puntos de corte (conjunciones, enumeraciones)
    for (let i = 0; i < splitPoints.length; i++) {
        const splitPos = splitPoints[i];
        const part = query.substring(currentStart, splitPos).trim();
        if (part.length > 10) { // Mínimo 10 caracteres por parte
            parts.push(part);
        }
        currentStart = splitPos;
    }
    // Agregar la última parte
    const lastPart = query.substring(currentStart).trim();
    if (lastPart.length > 10) {
        parts.push(lastPart);
    }
    // Si no se pudo dividir bien, intentar división por signos de interrogación
    const questionMarks = (query.match(/\?/g) || []).length;
    if (parts.length <= 1 && questionMarks >= 2) {
        const questionParts = query
            .split(/(?<=\?)\s+/) // Split después de ? seguido de espacio
            .map(p => p.trim())
            .filter(p => p.length > 10); // Mínimo 10 caracteres por parte
        if (questionParts.length > 1) {
            return questionParts;
        }
    }
    // Si aún no hay partes, devolver la consulta original
    if (parts.length === 0) {
        return [query.trim()];
    }
    return parts;
}
/**
 * Determina la complejidad de la consulta
 */
function determineComplexity(indicators, parts) {
    const hasComparison = indicators.some(ind => ind.type === 'comparative');
    if (hasComparison) {
        return 'comparative';
    }
    if (parts.length > 1) {
        return 'multi';
    }
    return 'simple';
}
/**
 * Calcula la confianza general de que es una consulta multi-parte
 */
function calculateConfidence(indicators, parts) {
    if (indicators.length === 0) {
        return 0.0;
    }
    // Promedio ponderado de confianzas de indicadores
    const avgConfidence = indicators.reduce((sum, ind) => sum + ind.confidence, 0) / indicators.length;
    // Bonus si se detectaron múltiples partes
    const partsBonus = parts.length > 1 ? 0.2 : 0.0;
    // Bonus si hay indicadores de tipos diferentes
    const uniqueTypes = new Set(indicators.map(ind => ind.type)).size;
    const diversityBonus = uniqueTypes >= 2 ? 0.1 : 0.0;
    const totalConfidence = Math.min(avgConfidence + partsBonus + diversityBonus, 1.0);
    return Math.round(totalConfidence * 100) / 100; // Redondear a 2 decimales
}
/**
 * Analiza una consulta y determina si es multi-parte
 *
 * @param query - Consulta del usuario
 * @returns Análisis completo de la consulta
 *
 * @example
 * ```typescript
 * const result = analyzeQuery("¿Cuáles son los requisitos para la acción de tutela y cuánto tiempo tarda?");
 * console.log(result.isMultiPart); // true
 * console.log(result.parts); // ["¿Cuáles son los requisitos para la acción de tutela", "cuánto tiempo tarda?"]
 * ```
 */
export function analyzeQuery(query) {
    // Normalizar espacios en blanco
    const normalizedQuery = query.trim().replace(/\s+/g, ' ');
    // Detectar indicadores
    const indicators = detectIndicators(normalizedQuery);
    // Dividir en partes
    const parts = splitIntoParts(normalizedQuery, indicators);
    // Determinar complejidad
    const complexity = determineComplexity(indicators, parts);
    // Calcular confianza
    const confidence = calculateConfidence(indicators, parts);
    // Metadata adicional
    const questionCount = (normalizedQuery.match(/\?/g) || []).length;
    const themeCount = LEGAL_THEMES.filter(theme => normalizedQuery.toLowerCase().includes(theme)).length;
    const hasComparison = indicators.some(ind => ind.type === 'comparative');
    const hasEnumeration = indicators.some(ind => ind.type === 'enumeration');
    // Es multi-parte si:
    // 1. Tiene más de una parte identificada, o
    // 2. Tiene alta confianza (>= 0.7) de indicadores multi-parte
    const isMultiPart = parts.length > 1 || confidence >= 0.7;
    return {
        isMultiPart,
        complexity,
        parts,
        indicators,
        confidence,
        metadata: {
            questionCount,
            themeCount,
            hasComparison,
            hasEnumeration,
        },
    };
}
/**
 * Versión simplificada de analyzeQuery que solo retorna campos básicos
 * (para compatibilidad con otras partes del sistema)
 */
export function detectMultiPart(query) {
    const analysis = analyzeQuery(query);
    return {
        isMultiPart: analysis.isMultiPart,
        parts: analysis.parts,
        complexity: analysis.complexity,
    };
}
// =====================================================================
// TESTS BÁSICOS
// =====================================================================
/**
 * Tests unitarios básicos del detector
 *
 * Para ejecutar los tests:
 * ```bash
 * node scripts/test-query-decomposer.mjs
 * ```
 */
