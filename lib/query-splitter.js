/**
 * Query Splitter - Descomponedor de Consultas Multi-Parte
 *
 * Divide consultas multi-parte en sub-preguntas independientes manteniendo
 * el contexto común y identificando dependencias entre sub-preguntas.
 *
 * Este módulo extiende el Query Decomposer (lib/query-decomposer.ts) para
 * generar sub-consultas que puedan ser procesadas independientemente por el RAG.
 *
 * @module query-splitter
 * @created 2026-02-10
 * @version 1.0.0
 */
import { analyzeQuery } from './query-decomposer.js';
/**
 * Patrones para extracción de entidades y contexto
 */
const EXTRACTION_PATTERNS = {
    // Fechas (ej: "2024", "enero de 2024", "20 de diciembre", "hace 3 meses")
    dates: [
        /\b(?:19|20)\d{2}\b/g, // Años
        /\b(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(?:de\s+)?(?:19|20)?\d{2,4}\b/gi,
        /\b\d{1,2}\s+de\s+(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)(?:\s+de\s+(?:19|20)?\d{2,4})?\b/gi,
        /\bhace\s+\d+\s+(?:días|semanas|meses|años)\b/gi,
    ],
    // Nombres propios (con mayúsculas)
    people: [
        /\b[A-ZÁ-Ú][a-zá-ú]+(?:\s+[A-ZÁ-Ú][a-zá-ú]+){1,3}\b/g,
    ],
    // Procedimientos legales comunes
    procedures: [
        /\b(?:acción\s+de\s+)?tutela\b/gi,
        /\b(?:acción\s+de\s+)?cumplimiento\b/gi,
        /\b(?:acción\s+de\s+)?grupo\b/gi,
        /\bacción\s+popular\b/gi,
        /\bproceso\s+(?:laboral|civil|penal|administrativo|ejecutivo|ordinario|verbal)\b/gi,
        /\b(?:demanda|denuncia|querella)\b/gi,
        /\b(?:recurso|apelación|casación|revisión)\b/gi,
        /\breparación\s+directa\b/gi,
    ],
    // Entidades públicas/privadas
    entities: [
        /\b(?:juzgado|tribunal|corte|consejo\s+de\s+estado)\b/gi,
        /\b(?:superintendencia|ministerio|alcaldía|gobernación)\b/gi,
        /\b(?:policía|ejército|fiscalía|procuraduría)\b/gi,
        /\b(?:eps|ips|hospital|clínica)\b/gi,
        /\b(?:empresa|compañía|sociedad|firma)\b/gi,
    ],
    // Montos y cantidades
    amounts: [
        /\$\s*[\d,]+(?:\.\d{2})?\b/g, // $1,000,000 o $1,000,000.00
        /\b\d+\s*(?:SMLMV|salarios?\s+mínimos?)\b/gi,
        /\b\d+\s*(?:millones?|mil|pesos)\b/gi,
    ],
    // Temas legales específicos
    topics: [
        /\b(?:derecho|derechos)\s+(?:fundamentales?|humanos?|laborales?|civiles?|penales?)\b/gi,
        /\b(?:pensión|jubilación|cesantías?|prima|vacaciones|salario)\b/gi,
        /\b(?:despido|desvinculación|liquidación)\b/gi,
        /\b(?:contrato|convenio|acuerdo)\b/gi,
        /\b(?:daños?|perjuicios?|indemnización)\b/gi,
    ],
};
/**
 * Extrae el contexto común de una consulta
 */
function extractContext(query) {
    const context = {};
    // Extraer fechas
    const dates = [];
    for (const pattern of EXTRACTION_PATTERNS.dates) {
        const matches = [...query.matchAll(pattern)];
        dates.push(...matches.map(m => m[0]));
    }
    if (dates.length > 0) {
        context.dates = [...new Set(dates)]; // Eliminar duplicados
    }
    // Extraer nombres propios
    const people = [];
    for (const pattern of EXTRACTION_PATTERNS.people) {
        const matches = [...query.matchAll(pattern)];
        people.push(...matches.map(m => m[0]));
    }
    // Filtrar nombres comunes que no son personas (ej. "Código")
    const commonWords = ['Código', 'Ley', 'Decreto', 'Artículo', 'Estado', 'Colombia'];
    const filteredPeople = people.filter(name => !commonWords.includes(name));
    if (filteredPeople.length > 0) {
        context.people = [...new Set(filteredPeople)];
    }
    // Extraer procedimientos legales
    const procedures = [];
    for (const pattern of EXTRACTION_PATTERNS.procedures) {
        const matches = [...query.matchAll(pattern)];
        procedures.push(...matches.map(m => m[0].toLowerCase()));
    }
    if (procedures.length > 0) {
        context.procedures = [...new Set(procedures)];
    }
    // Extraer entidades
    const entities = [];
    for (const pattern of EXTRACTION_PATTERNS.entities) {
        const matches = [...query.matchAll(pattern)];
        entities.push(...matches.map(m => m[0].toLowerCase()));
    }
    if (entities.length > 0) {
        context.entities = [...new Set(entities)];
    }
    // Extraer montos
    const amounts = [];
    for (const pattern of EXTRACTION_PATTERNS.amounts) {
        const matches = [...query.matchAll(pattern)];
        amounts.push(...matches.map(m => m[0]));
    }
    if (amounts.length > 0) {
        context.amounts = [...new Set(amounts)];
    }
    // Extraer temas legales
    const topics = [];
    for (const pattern of EXTRACTION_PATTERNS.topics) {
        const matches = [...query.matchAll(pattern)];
        topics.push(...matches.map(m => m[0].toLowerCase()));
    }
    if (topics.length > 0) {
        context.topics = [...new Set(topics)];
    }
    return context;
}
/**
 * Enriquece una sub-consulta añadiendo contexto faltante
 */
function enrichSubQuery(subQueryText, commonContext, order, originalTextHasProcedure) {
    // Extraer contexto específico de esta sub-consulta
    const localContext = extractContext(subQueryText);
    // Combinar contexto común con contexto local
    const combinedContext = {
        dates: [...(commonContext.dates || []), ...(localContext.dates || [])],
        people: [...(commonContext.people || []), ...(localContext.people || [])],
        procedures: [...(commonContext.procedures || []), ...(localContext.procedures || [])],
        entities: [...(commonContext.entities || []), ...(localContext.entities || [])],
        amounts: [...(commonContext.amounts || []), ...(localContext.amounts || [])],
        topics: [...(commonContext.topics || []), ...(localContext.topics || [])],
    };
    // Eliminar duplicados
    Object.keys(combinedContext).forEach(key => {
        const k = key;
        if (combinedContext[k] && combinedContext[k].length > 0) {
            combinedContext[k] = [...new Set(combinedContext[k])];
        }
        else {
            delete combinedContext[k];
        }
    });
    // Determinar si la sub-consulta necesita ser enriquecida con contexto explícito
    let enrichedQuery = subQueryText.trim();
    // Si la sub-consulta no menciona el procedimiento pero el contexto común sí lo tiene
    if (!originalTextHasProcedure &&
        commonContext.procedures?.length &&
        /\b(?:cuál|cuáles|qué|cómo|cuándo|cuánto|dónde)\b/i.test(enrichedQuery)) {
        // Añadir referencia al procedimiento en la pregunta
        const proc = commonContext.procedures[0];
        if (!enrichedQuery.includes(proc)) {
            enrichedQuery = enrichedQuery.replace(/^(¿?[^?]+)(\??)/, `$1 (en el contexto de ${proc})$2`);
        }
    }
    return {
        query: enrichedQuery,
        context: combinedContext,
        order,
        dependsOn: [],
    };
}
/**
 * Identifica dependencias entre sub-consultas
 *
 * Una sub-consulta depende de otra si:
 * 1. Usa pronombres que refieren a entidades de la consulta anterior
 * 2. Pregunta por "tiempo", "costo", "requisitos" de algo mencionado antes
 * 3. Es una comparación que requiere respuesta de la anterior
 */
function identifyDependencies(subQueries, originalParts) {
    const dependencies = [];
    for (let i = 1; i < subQueries.length; i++) {
        const current = subQueries[i];
        const previous = subQueries[i - 1];
        const currentOriginal = originalParts[i];
        const previousOriginal = originalParts[i - 1];
        // Detectar pronombres que refieren a la consulta anterior
        const pronounPatterns = [
            /\b(?:es[oa]|est[oa]s|ell[oa]s|lo|la|los|las)\b/gi,
            /\b(?:su|sus|de\s+(?:es[oa]|ell[oa]s))\b/gi,
        ];
        // Solo marcar dependencia por pronombres si:
        // 1. La consulta actual NO tiene procedimiento explícito diferente (en texto original)
        // 2. La consulta anterior SÍ tiene procedimiento (en texto original)
        const currentHasExplicitProcedure = /\b(?:tutela|cumplimiento|grupo|laboral|ejecutivo|reparación|acción\s+de)\b/i.test(currentOriginal);
        const previousHasExplicitProcedure = /\b(?:tutela|cumplimiento|grupo|laboral|ejecutivo|reparación|acción\s+de)\b/i.test(previousOriginal);
        for (const pattern of pronounPatterns) {
            if (pattern.test(currentOriginal) && !currentHasExplicitProcedure && previousHasExplicitProcedure) {
                dependencies.push({
                    from: i,
                    to: i - 1,
                    reason: 'Usa pronombre que refiere a consulta anterior',
                });
                break;
            }
        }
        // Detectar si pregunta por atributos de algo mencionado antes
        const attributePatterns = [
            /\b(?:cuánto|cuánta|cuántos|cuántas)\s+(?:cuesta|vale|tarda|tiempo|plazo)\b/gi,
            /\b(?:qué|cuáles)\s+(?:requisitos?|documentos?|pasos?|etapas?)\b/gi,
        ];
        for (const pattern of attributePatterns) {
            // Solo marcar dependencia si:
            // 1. La consulta actual NO menciona procedimientos específicos en el texto original
            // 2. La consulta anterior SÍ menciona procedimientos
            // 3. La consulta actual hace pregunta sobre atributos
            if (pattern.test(currentOriginal) && !currentHasExplicitProcedure && previous.context.procedures?.length) {
                dependencies.push({
                    from: i,
                    to: i - 1,
                    reason: 'Pregunta por atributo de procedimiento mencionado antes',
                });
                break;
            }
        }
        // Detectar comparaciones implícitas
        if (/\b(?:diferencia|comparación|versus|vs\.?)\b/i.test(currentOriginal)) {
            // La comparación probablemente se refiere a algo mencionado antes
            if (!current.context.procedures || current.context.procedures.length < 2) {
                dependencies.push({
                    from: i,
                    to: i - 1,
                    reason: 'Comparación que requiere información de consulta anterior',
                });
            }
        }
    }
    return dependencies;
}
/**
 * Divide una consulta multi-parte en sub-consultas independientes
 *
 * @param query - Consulta del usuario
 * @returns Resultado de la descomposición con sub-consultas y dependencias
 *
 * @example
 * ```typescript
 * const result = splitQuery("¿Cuáles son los requisitos para la acción de tutela y cuánto tiempo tarda?");
 *
 * console.log(result.subQueries);
 * // [
 * //   {
 * //     query: "¿Cuáles son los requisitos para la acción de tutela?",
 * //     context: { procedures: ["tutela"] },
 * //     order: 0,
 * //     dependsOn: []
 * //   },
 * //   {
 * //     query: "¿Cuánto tiempo tarda (en el contexto de acción de tutela)?",
 * //     context: { procedures: ["tutela"] },
 * //     order: 1,
 * //     dependsOn: [0]
 * //   }
 * // ]
 * ```
 */
export function splitQuery(query) {
    // Paso 1: Analizar la consulta con el detector
    const analysis = analyzeQuery(query);
    // Si no es multi-parte, devolver consulta única
    if (!analysis.isMultiPart) {
        const context = extractContext(query);
        return {
            subQueries: [
                {
                    query: query.trim(),
                    context,
                    order: 0,
                    dependsOn: [],
                },
            ],
            commonContext: context,
            complexity: analysis.complexity,
            dependencies: [],
        };
    }
    // Paso 2: Extraer contexto común
    const commonContext = extractContext(query);
    // Paso 3: Crear sub-consultas enriquecidas
    const subQueries = analysis.parts.map((part, index) => {
        const hasExplicitProcedure = /\b(?:tutela|cumplimiento|grupo|laboral|ejecutivo|reparación|acción\s+de)\b/i.test(part);
        return enrichSubQuery(part, commonContext, index, hasExplicitProcedure);
    });
    // Paso 4: Identificar dependencias
    const dependencies = identifyDependencies(subQueries, analysis.parts);
    // Actualizar campo dependsOn en subQueries
    for (const dep of dependencies) {
        if (subQueries[dep.from]) {
            subQueries[dep.from].dependsOn.push(dep.to);
        }
    }
    return {
        subQueries,
        commonContext,
        complexity: analysis.complexity,
        dependencies,
    };
}
/**
 * Divide una consulta y retorna solo las sub-consultas como strings
 * (versión simplificada para compatibilidad)
 */
export function splitQuerySimple(query) {
    const result = splitQuery(query);
    return result.subQueries.map(sq => sq.query);
}
