# Base de Datos de Procedimientos Legales Colombianos

Esta base de datos contiene procedimientos legales estructurados para el sistema ColLawRAG, diseñados para proporcionar información precisa sobre los trámites judiciales más comunes en Colombia.

## Estructura de los archivos

Cada procedimiento está almacenado en un archivo JSON independiente con la siguiente estructura:

```json
{
  "id": "identificador_unico",
  "nombre": "Nombre oficial del procedimiento",
  "descripcion": "Descripción breve",
  "normas_ref": ["Leyes y decretos aplicables"],
  "etapas": [
    {
      "nombre": "Nombre de la etapa",
      "orden": 1,
      "plazos": {
        "dias": 0,
        "descripcion": "Descripción del plazo",
        "hitos": ["Eventos importantes de esta etapa"]
      },
      "documentos": ["Documentos requeridos o producidos"],
      "entidades": [
        {
          "rol": "nombre_del_rol",
          "descripcion": "Descripción del rol"
        }
      ]
    }
  ],
  "notas": ["Información adicional relevante"]
}
```

## Procedimientos incluidos

### 1. Acción de Tutela (`tutela.json`)
- **Tipo:** Constitucional
- **Duración:** 10-30 días
- **Objetivo:** Protección inmediata de derechos fundamentales
- **Etapas:** 10 (desde presentación hasta cumplimiento)

### 2. Acción de Cumplimiento (`cumplimiento.json`)
- **Tipo:** Constitucional
- **Duración:** 60-90 días
- **Objetivo:** Exigir cumplimiento de leyes y actos administrativos
- **Etapas:** 10 (incluye requisito de procedibilidad previo)

### 3. Proceso Laboral Ordinario (`laboral_ordinario.json`)
- **Tipo:** Laboral
- **Duración:** 6-12 meses
- **Cuantía:** Superior a 20 SMLMV
- **Etapas:** 12 (incluye posible casación y ejecución)

### 4. Proceso Laboral Verbal (`laboral_verbal.json`)
- **Tipo:** Laboral
- **Duración:** 1-3 meses
- **Cuantía:** Hasta 20 SMLMV
- **Etapas:** 8 (audiencia única concentrada)

## Uso en ColLawRAG

Esta base de datos está diseñada para:

1. **Responder preguntas sobre procedimientos:** "¿Cuánto dura una tutela?", "¿Qué documentos necesito para una demanda laboral?"
2. **Calcular plazos procesales:** Estimar fechas de vencimiento de términos
3. **Identificar documentos requeridos:** Por etapa y por procedimiento
4. **Explicar roles de las entidades:** Quiénes intervienen y cuándo

## Integración con el sistema

Para integrar esta base de datos con el sistema RAG:

1. **Indexación:** Los archivos JSON deben ser indexados junto con los documentos legales
2. **Consultas estructuradas:** El sistema puede consultar directamente el JSON para respuestas precisas sobre plazos y etapas
3. **Validación de respuestas:** Comparar respuestas generadas con la estructura oficial del procedimiento

## Expansión futura

Procedimientos pendientes de agregar:

- **Procedimiento civil ordinario**
- **Procedimiento civil verbal**
- **Procedimiento administrativo**
- **Procedimiento penal (ordinario y abreviado)**
- **Proceso de nulidad y restablecimiento del derecho**
- **Proceso de responsabilidad fiscal**

## Mantenimiento

Esta base de datos debe actualizarse cuando:

- Cambien las normas procesales (nuevas leyes)
- Se modifiquen los plazos por reformas al código
- Se identifiquen errores o inconsistencias
- Se agreguen nuevos procedimientos

## Licencia y uso

Esta información se basa en las normas legales vigentes de Colombia y está destinada únicamente para uso del sistema ColLawRAG. No constituye asesoría jurídica.

---

**Versión:** 1.0  
**Fecha de creación:** 2026-02-03  
**Última actualización:** 2026-02-03
