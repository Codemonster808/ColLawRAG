# Generador de Payloads TOON (Python)

Script en Python que genera TOON **real** y válido conforme a la spec oficial de
[Token-Oriented Object Notation](https://github.com/toon-format/spec/blob/main/SPEC.md).

~40% menos tokens que JSON equivalente, sin dependencias externas, 100% offline.

---

## Qué es TOON

| Estructura | JSON | TOON |
|---|---|---|
| Objeto escalar | `{"nombre": "Ana", "activo": true}` | `nombre: Ana`<br>`activo: true` |
| Array primitivo | `{"tags": ["a","b","c"]}` | `tags[3]: a,b,c` |
| **Array de objetos** (sweet spot) | `[{"id":1,"cargo":"Dev"},...]` | `items[2]{id,cargo}:`<br>`  1,Dev`<br>`  2,QA` |
| Objeto anidado | `{"config": {"k": 1}}` | `config:`<br>`  k: 1` |

---

## Instalación

Solo Python 3.6+, sin dependencias:

```bash
python3 --version  # >= 3.6 requerido
chmod +x scripts/generate_toon_payload.py  # opcional
```

---

## Uso

### Modo principal — desde JSON (conversión exacta)

```bash
# Archivo JSON
python3 scripts/generate_toon_payload.py --json data.json

# JSON inline
python3 scripts/generate_toon_payload.py --json '{"nombre":"Ana","edad":30}'

# Desde stdin (para pipelines)
cat data.json | python3 scripts/generate_toon_payload.py --stdin

# Solo TOON sin decoración (para scripts)
python3 scripts/generate_toon_payload.py --json data.json --raw
```

### Texto libre (heurístico)

```bash
# Proyecto con tareas
python3 scripts/generate_toon_payload.py \
  "El proyecto Alfa tiene 3 tareas: Diseño (alta, completada), Desarrollo (media, no completada). Equipo: Core."

# Pares clave-valor
python3 scripts/generate_toon_payload.py \
  "Nombre: Juan Pérez, Edad: 30, Ciudad: Bogotá, Activo: sí"

# Consulta legal
python3 scripts/generate_toon_payload.py \
  "Consulta sobre indemnización por despido sin justa causa en Colombia"
```

### Guardar output

```bash
python3 scripts/generate_toon_payload.py --json data.json --output payload.toon
```

### Modo interactivo

```bash
python3 scripts/generate_toon_payload.py --interactive
# o
python3 scripts/generate_toon_payload.py -i
```

Acepta texto libre, JSON inline, o rutas a archivos JSON.

---

## Ejemplos de output

### Chunks RAG — caso de uso principal en ColLawRAG

```bash
python3 scripts/generate_toon_payload.py --json '{
  "query": "¿Cuánto es el salario mínimo en 2024?",
  "chunks": [
    {"id": 1, "titulo": "Art. 145 CST", "texto": "El salario mínimo será fijado anualmente", "fuente": "cst", "vigente": true, "area": "laboral"},
    {"id": 2, "titulo": "Decreto 2613 2023", "texto": "Por el cual se fija el salario mínimo", "fuente": "decreto-2613-2023", "vigente": true, "area": "laboral"}
  ]
}'
```

**Output TOON:**
```toon
query: ¿Cuánto es el salario mínimo en 2024?
chunks[2]{id,titulo,texto,fuente,vigente,area}:
  1,Art. 145 CST,El salario mínimo será fijado anualmente,cst,true,laboral
  2,Decreto 2613 2023,Por el cual se fija el salario mínimo,decreto-2613-2023,true,laboral
```

**Ahorro: ~45% menos tokens** vs JSON equivalente.

---

### Proyecto con tareas (texto libre)

```bash
python3 scripts/generate_toon_payload.py \
  "El proyecto Alfa tiene 3 tareas: Diseño (alta, completada), Desarrollo (media, no completada), Pruebas (baja, completada). Equipo: Core."
```

**Output TOON:**
```toon
nombre: Alfa
equipo: Core
tareas[3]{nombre,prioridad,completada}:
  Diseño,alta,true
  Desarrollo,media,false
  Pruebas,baja,true
```

**Ahorro: ~62% menos tokens.**

---

### Objeto con anidados

```bash
python3 scripts/generate_toon_payload.py --json '{
  "empresa": "XYZ S.A.S.",
  "config": {"max_queries": 100, "cache": true},
  "empleados": [
    {"id": 1, "nombre": "Ana García", "salario": 3500000},
    {"id": 2, "nombre": "Carlos López", "salario": 2800000}
  ]
}'
```

**Output TOON:**
```toon
empresa: XYZ S.A.S.
config:
  max_queries: 100
  cache: true
empleados[2]{id,nombre,salario}:
  1,Ana García,3500000
  2,Carlos López,2800000
```

---

## Reglas de encoding implementadas

| Tipo de dato | Encoding TOON |
|---|---|
| String simple | `valor` (sin comillas) |
| String con coma/salto | `"valor, con coma"` |
| Número entero | `42` |
| Float | `3.14` |
| Booleano | `true` / `false` |
| Nulo | `null` |
| Array de objetos uniformes | Formato tabular `key[N]{f1,f2}:` + filas CSV |
| Array de primitivos | `key[N]: v1,v2,v3` |
| Array no uniforme | YAML-style con `- item` |
| Objeto anidado | YAML-style con indentación 2 espacios |

---

## Opciones CLI

```
Argumentos posicionales:
  input_text          Texto libre a convertir (heurístico)

Flags:
  --json, -j JSON     JSON como string o ruta a archivo .json
  --stdin             Leer JSON desde stdin
  --file, -f FILE     Archivo de texto plano
  --output, -o FILE   Guardar TOON en archivo
  --raw, -r           Solo imprimir TOON (sin stats, para pipelines)
  --stats-only        Imprimir solo estadísticas JSON
  --interactive, -i   Modo interactivo
```

---

## Integración en ColLawRAG

Para enviar los chunks del retrieval al LLM en TOON:

```typescript
// lib/generation.ts — antes de llamar al LLM
import { encode } from '@toon-format/toon'

const context = encode({
  query: params.query,
  chunks: retrievedChunks.map(c => ({
    id: c.chunk.id,
    titulo: c.chunk.metadata.title,
    texto: c.chunk.content.slice(0, 300),
    fuente: c.chunk.metadata.type,
    vigente: true,
    area: legalArea
  }))
})

// context es ahora ~40% más compacto que JSON
```

También disponible vía CLI en package.json:
```bash
npm run toon          # modo interactivo JS (con LLM)
npm run toon:demo     # demo con datos de ejemplo
```

---

## Comparación con el script JS

| Feature | `generate_toon_payload.py` | `toon-generator.mjs` |
|---|---|---|
| Encoder TOON propio | ✅ (impl. Python) | ✅ (`@toon-format/toon`) |
| JSON → TOON exacto | ✅ | ✅ |
| Texto libre → TOON | ✅ (heurístico) | ❌ |
| LLM para texto libre | ❌ | ✅ (DeepSeek V3.2) |
| Sin dependencias | ✅ | ❌ (Node.js) |
| Stats de tokens | ✅ | ✅ |
| Pipeline-friendly (--raw) | ✅ | ✅ (--out) |

Usa el Python para conversiones JSON exactas y pipelines. Usa el JS (`npm run toon`) para
generar payloads de ejemplo con ayuda del LLM.

---

## Ayuda

```bash
python3 scripts/generate_toon_payload.py --help
```
