# Sistema de Gestión de Vigencia de Normas Legales

Este módulo proporciona funcionalidad completa para gestionar la vigencia, derogación y modificación de normas legales colombianas en el sistema ColLawRAG.

## Características

- ✅ **Consulta de vigencia** por fecha específica
- ❌ **Registro de derogaciones** totales y parciales
- 📝 **Seguimiento de modificaciones** (modificación, adición, subrogación, aclaración)
- 📊 **Filtrado por estado** (vigente, derogada, parcialmente derogada)
- 📋 **Reportes detallados** de vigencia de normas

## Estructura de datos

Cada norma se almacena en un archivo JSON individual:

```json
{
  "normaId": "ley-100-1993",
  "nombre": "Ley 100 de 1993",
  "tipo": "ley",
  "vigenteDesde": "1993-12-23",
  "vigenteHasta": null,
  "estado": "vigente | derogada | parcialmente_derogada",
  "derogadaPor": "ley-xxx-xxxx",
  "derogadaDesde": "YYYY-MM-DD",
  "derogacionesParciales": [
    {
      "articulo": "Art. 5",
      "derogadoPor": "ley-797-2003",
      "derogadaDesde": "2003-01-29",
      "razon": "Modificación del régimen pensional"
    }
  ],
  "modificaciones": [
    {
      "norma": "ley-797-2003",
      "fecha": "2003-01-29",
      "tipo": "modificacion",
      "descripcion": "Reforma al sistema general de pensiones"
    }
  ],
  "notas": ["Información adicional relevante"]
}
```

## Uso desde TypeScript/JavaScript

### Importar el módulo

```typescript
import {
  consultarVigencia,
  crearNorma,
  registrarDerogacionTotal,
  registrarDerogacionParcial,
  registrarModificacion,
  filtrarPorEstado,
  generarReporte
} from '../lib/norm-vigencia';
```

### Ejemplos de uso

#### 1. Consultar vigencia de una norma

```typescript
// Consultar vigencia actual
const vigencia = consultarVigencia('ley-100-1993');

// Consultar vigencia en una fecha específica
const vigenciaEn2020 = consultarVigencia('ley-100-1993', '2020-01-15');

if (vigenciaEn2020?.vigente) {
  console.log('La norma estaba vigente en esa fecha');
  
  if (vigenciaEn2020.estado === 'parcialmente_derogada') {
    console.log('Derogaciones parciales:', vigenciaEn2020.derogaciones);
  }
}
```

#### 2. Crear una nueva norma

```typescript
crearNorma({
  normaId: 'ley-2277-2022',
  nombre: 'Ley 2277 de 2022',
  tipo: 'ley',
  vigenteDesde: '2022-12-13',
  vigenteHasta: null,
  estado: 'vigente'
});
```

#### 3. Registrar una derogación total

```typescript
registrarDerogacionTotal(
  'ley-50-1990',           // Norma derogada
  'ley-789-2002',          // Norma que deroga
  '2002-12-27'             // Fecha de derogación
);
```

#### 4. Registrar una derogación parcial

```typescript
registrarDerogacionParcial('ley-100-1993', {
  articulo: 'Art. 13',
  derogadoPor: 'ley-797-2003',
  derogadaDesde: '2003-01-29',
  razon: 'Modificación del régimen de pensiones'
});
```

#### 5. Registrar una modificación

```typescript
registrarModificacion('ley-100-1993', {
  norma: 'ley-1122-2007',
  fecha: '2007-01-09',
  tipo: 'modificacion',
  descripcion: 'Modificaciones al Sistema General de Seguridad Social en Salud'
});
```

#### 6. Filtrar normas por estado

```typescript
// Obtener todas las normas vigentes actualmente
const normasVigentes = filtrarPorEstado('vigente');

// Obtener normas vigentes en una fecha específica
const vigenteEn2010 = filtrarPorEstado('vigente', '2010-06-15');

// Obtener normas derogadas
const derogadas = filtrarPorEstado('derogada');
```

#### 7. Generar reporte

```typescript
const reporte = generarReporte('ley-100-1993');
console.log(reporte);
```

## Uso desde línea de comandos (CLI)

### Comandos disponibles

#### Ver ayuda
```bash
npm run vigencia
# o
node scripts/vigencia-normas.mjs
```

#### Consultar vigencia
```bash
# Vigencia actual
npm run vigencia consultar ley-100-1993

# Vigencia en fecha específica
npm run vigencia consultar ley-100-1993 2020-01-15
```

#### Crear norma
```bash
npm run vigencia crear ley-2277-2022 "Ley 2277 de 2022" ley 2022-12-13
```

#### Derogar totalmente
```bash
npm run vigencia derogar ley-50-1990 ley-789-2002 2002-12-27
```

#### Derogar parcialmente
```bash
npm run vigencia derogar-parcial ley-100-1993 ley-797-2003 "Art. 13" 2003-01-29 "Modificación del régimen pensional"
```

#### Registrar modificación
```bash
npm run vigencia modificar ley-100-1993 ley-797-2003 2003-01-29 modificacion "Reforma al sistema de pensiones"
```

#### Listar normas
```bash
# Todas las normas
npm run vigencia todas

# Por estado (vigentes, derogadas, parcialmente derogadas)
npm run vigencia listar vigente
npm run vigencia listar derogada
npm run vigencia listar parcialmente_derogada

# Por estado en fecha específica
npm run vigencia listar vigente 2010-01-01
```

#### Generar reporte
```bash
npm run vigencia reporte ley-100-1993
```

## Integración con ColLawRAG

### En el proceso de ingest

El sistema puede integrarse en el proceso de ingest para etiquetar chunks con información de vigencia:

```typescript
import { consultarVigencia } from './lib/norm-vigencia';

// Al procesar cada documento
const vigencia = consultarVigencia(documentId);

if (vigencia && !vigencia.vigente) {
  // Etiquetar el chunk como derogado
  chunk.metadata.vigente = false;
  chunk.metadata.derogadaPor = vigencia.derogadaPor;
  chunk.metadata.derogadaDesde = vigencia.derogadaDesde;
} else {
  chunk.metadata.vigente = true;
}
```

### En la búsqueda/retrieval

Filtrar resultados por vigencia en una fecha específica:

```typescript
import { consultarVigencia } from './lib/norm-vigencia';

// Después de obtener resultados
const resultadosFiltrados = results.filter(result => {
  const vigencia = consultarVigencia(result.metadata.normaId, fechaConsulta);
  return vigencia?.vigente === true;
});
```

### En las respuestas

Incluir advertencias sobre normas derogadas:

```typescript
const vigencia = consultarVigencia(normaId);

if (vigencia && !vigencia.vigente) {
  respuesta += `\n\n⚠️ ADVERTENCIA: Esta norma fue derogada`;
  if (vigencia.derogadaPor) {
    respuesta += ` por ${vigencia.derogadaPor}`;
  }
  if (vigencia.derogadaDesde) {
    respuesta += ` el ${vigencia.derogadaDesde}`;
  }
}
```

## Normas de ejemplo incluidas

El sistema incluye 6 normas de ejemplo con datos reales:

1. **Ley 100 de 1993** - Sistema de Seguridad Social (parcialmente derogada)
2. **Decreto 2591 de 1991** - Acción de tutela (vigente)
3. **Ley 50 de 1990** - Reforma laboral (derogada)
4. **Ley 57 de 1887** - Código Civil (parcialmente derogada)
5. **Ley 1437 de 2011** - Código de Procedimiento Administrativo (vigente)
6. **Ley 599 de 2000** - Código Penal (parcialmente derogada)

## Tipos de normas soportados

- `ley` - Leyes ordinarias y estatutarias
- `decreto` - Decretos del gobierno
- `acto_legislativo` - Reformas constitucionales
- `codigo` - Códigos (Civil, Penal, Comercio, etc.)
- `resolucion` - Resoluciones de entidades
- `acuerdo` - Acuerdos municipales o distritales

## Tipos de modificaciones

- `modificacion` - Cambio en artículos o disposiciones
- `adicion` - Agregado de nuevos artículos
- `subrogacion` - Sustitución completa de artículos
- `aclaracion` - Aclaración de disposiciones ambiguas

## Mantenimiento

### Agregar nuevas normas

1. Crear un archivo JSON en `data/normas-vigencia/` con el ID de la norma
2. Usar el CLI o el módulo para crear la norma
3. Registrar derogaciones y modificaciones según corresponda

### Actualizar vigencia

Cuando una norma sea derogada o modificada:

```bash
# Derogación total
npm run vigencia derogar <normaId> <derogadaPor> <fecha>

# Derogación parcial
npm run vigencia derogar-parcial <normaId> <derogadaPor> <articulo> <fecha> [razon]

# Modificación
npm run vigencia modificar <normaId> <modificadaPor> <fecha> <tipo> [descripcion]
```

## Scripts NPM

Agregar a `package.json`:

```json
{
  "scripts": {
    "vigencia": "node scripts/vigencia-normas.mjs"
  }
}
```

## Consideraciones importantes

- Las fechas deben estar en formato **YYYY-MM-DD**
- Los IDs de normas deben ser únicos y consistentes (ej: `ley-100-1993`, `decreto-2591-1991`)
- El sistema no valida automáticamente las relaciones entre normas (responsabilidad del usuario)
- Para derogaciones parciales, especificar claramente el artículo o sección
- Las modificaciones no afectan automáticamente el estado de vigencia (solo las derogaciones)

## Roadmap futuro

- [ ] Validación automática de referencias entre normas
- [ ] Integración con el sistema de ingest para autodetección de derogaciones
- [ ] API REST para consultas externas
- [ ] Visualización de línea de tiempo de modificaciones
- [ ] Exportación a formatos (PDF, Excel) de reportes de vigencia
- [ ] Búsqueda full-text en notas y razones de derogación

---

**Versión:** 1.0  
**Fecha de creación:** 2026-02-03  
**Última actualización:** 2026-02-03
