# Prompt para dar el payload TOON al LLM

Usa uno de los prompts siguientes (o combínalos). Sustituye `FASE_0_CORRECCIONES_CRITICAS` y la ruta del payload por el que quieras ejecutar.

---

## Opción 1: Una sola fase (recomendado para empezar)

Copia y pega en Cursor, y adjunta el `.toon` con `@`:

```
Implementa el plan definido en el payload TOON adjunto.

Reglas:
1. El payload es la única fuente de verdad: sigue `orden_ejecucion`, implementa cada entrada de `tareas[]` y modifica solo los archivos listados en `archivos_modificar[]`.
2. No modifiques los documentos base en `docs/mejoras/*.md`; solo el código del proyecto.
3. Para cada tarea: haz los cambios en los archivos indicados y cumple la columna `validacion` (criterios de aceptación).
4. Al terminar, comprueba que se cumplen todos los ítems de `criterio_exito[]`.

Empieza por la tarea del paso 1 en `orden_ejecucion` y sigue en orden. Si algo no está claro, usa `documento_base` como referencia de contexto (solo lectura).
```

**Uso:** escribe lo de arriba y añade en el chat:  
`@ColLawRAG/docs/mejoras/payloads/FASE_0_CORRECCIONES_CRITICAS.toon`

---

## Opción 2: Especificar la fase por nombre

```
Tengo el payload TOON de la fase que quiero implementar. Léelo y construye según él.

Payload: @ColLawRAG/docs/mejoras/payloads/FASE_0_CORRECCIONES_CRITICAS.toon

Instrucciones:
- Ejecuta las tareas en el orden indicado en `orden_ejecucion`.
- Modifica solo los archivos que aparecen en `archivos_modificar[]` con las acciones descritas.
- Respetar `criterio_exito[]` al finalizar.
- No editar ningún .md en docs/mejoras/; solo código del proyecto ColLawRAG.

Empieza por la primera tarea y ve paso a paso.
```

(Cambia `FASE_0_CORRECCIONES_CRITICAS` por `FASE_1_RETRIEVAL_OPTIMIZADO`, `FASE_2_CHUNKING_SEMANTICO`, etc., según la fase.)

---

## Opción 3: Empezar desde FASE_0 y recordar dependencias

```
Implementa el plan de mejoras ColLawRAG usando los payloads TOON.

Fase a implementar ahora: FASE_0 (correcciones críticas).  
Payload: @ColLawRAG/docs/mejoras/payloads/FASE_0_CORRECCIONES_CRITICAS.toon

Haz lo siguiente:
1. Lee el payload; toma `tareas[]`, `archivos_modificar[]`, `orden_ejecucion` y `criterio_exito[]` como especificación.
2. Implementa en orden: para cada paso en `orden_ejecucion`, completa la tarea indicada en los archivos correspondientes.
3. No toques los .md en docs/mejoras/.
4. Verifica que se cumple cada ítem de `criterio_exito[]` cuando termines.

Si el payload menciona dependencias (ej. "FASE_0 completada"), asume que ya están resueltas para fases posteriores; para esta sesión solo trabaja en FASE_0.
```

---

## Opción 4: Varias fases en secuencia (avanzado)

```
Voy a implementar varias fases del plan en orden. Usa solo los payloads TOON que te indiqué; no modifiques los .md en docs/mejoras/.

Payloads en orden (uno por mensaje o todos en este):
1. @ColLawRAG/docs/mejoras/payloads/FASE_0_CORRECCIONES_CRITICAS.toon
2. @ColLawRAG/docs/mejoras/payloads/FASE_1_RETRIEVAL_OPTIMIZADO.toon

Para cada payload:
- Sigue `orden_ejecucion` y `tareas[]`.
- Modifica solo `archivos_modificar[]`.
- Comprueba `criterio_exito[]` al cerrar esa fase.

Empieza por FASE_0; cuando esté cumplido su criterio_exito, sigue con FASE_1.
```

---

## Opción 5: Modo autónomo (payloads ajustados)

Los payloads incluyen bloque `autonomo{}`, `instruccion_concreta` y `comando_validacion` por tarea, más `post_fase_comando` y `siguiente_payload`. Usa este prompt para que el agente trabaje sin preguntar:

```
Ejecuta en modo autónomo el payload TOON adjunto.

1. Lee el bloque autonomo{}: ruta_proyecto es la raíz de trabajo; no_modificar son paths que no debes editar; prerequisitos deben cumplirse antes de empezar.
2. Para cada paso en orden_ejecucion, ejecuta la tarea indicada: sigue instruccion_concreta en tareas[]; modifica solo archivos en archivos_modificar[].
3. Después de cada tarea (o al final de la fase), ejecuta comando_validacion si está definido; si falla, aplica al_fallar (abortar_fase o reportar_y_continuar).
4. Al cerrar la fase, ejecuta post_fase_comando[] en orden.
5. Si siguiente_payload no es "ninguno", carga ese payload y repite desde 1 hasta completar todas las fases que quieras encadenar.

No modifiques ningún archivo listado en no_modificar. Usa documento_base solo como lectura para contexto.
```

**Para encadenar todo el plan desde el índice:**  
`@ColLawRAG/docs/mejoras/payloads/README_PLAN_MEJORAS.toon`  
(El payload índice apunta a FASE_0; cada fase apunta a la siguiente en `siguiente_payload`.)

**Para una sola fase autónoma:**  
`@ColLawRAG/docs/mejoras/payloads/FASE_0_CORRECCIONES_CRITICAS.toon` (o la que toque.)

---

## Opción 6: Cursor y OpenClaw en el mismo sprint (multi-agente)

Los payloads incluyen `multi_agente`, `asignacion_agente`, `grupos_paralelos` e `instruccion_herramienta`. Para que Cursor y OpenClaw trabajen a la vez en la misma fase:

**En Cursor** (adjunta el mismo .toon que use OpenClaw):
```
Trabajo en modo multi-agente. Soy Cursor. Lee el payload TOON adjunto y ejecuta solo la parte asignada a cursor.

1. En multi_agente: herramientas incluye cursor.
2. En asignacion_agente: ejecuta solo las tareas donde agente=cursor.
3. En instruccion_herramienta: sigue la línea herramienta=cursor.
4. No modifiques archivos listados como archivos_exclusivos del otro agente (open_claw).
5. Si hay archivos_compartidos, respeta orden_edicion (cursor primero o cursor después según la fase).
6. Si post_fase_agente=cursor, ejecuta post_fase_comando al cerrar la fase.

Payload: @ColLawRAG/docs/mejoras/payloads/FASE_0_CORRECCIONES_CRITICAS.toon
```

**En OpenClaw** (mismo .toon):
```
Trabajo en modo multi-agente. Soy OpenClaw. Lee el payload TOON adjunto y ejecuta solo la parte asignada a open_claw.

1. En multi_agente: herramientas incluye open_claw.
2. En asignacion_agente: ejecuta solo las tareas donde agente=open_claw.
3. En instruccion_herramienta: sigue la línea herramienta=open_claw.
4. No modifiques archivos listados como archivos_exclusivos del otro agente (cursor).
5. Si hay archivos_compartidos, respeta orden_edicion (open_claw solo después de cursor cuando aplique).
6. Ejecuta post_fase_comando solo si post_fase_agente=open_claw.

Payload: @ColLawRAG/docs/mejoras/payloads/FASE_0_CORRECCIONES_CRITICAS.toon
```

**Resumen por fase:**  
- **FASE_0:** ola 1 en paralelo (cursor 0.1, open_claw 0.2); luego cursor 0.3. Post-fase: cursor.  
- **FASE_1:** ola 1 cursor (1.1, 1.2); ola 2 open_claw (1.3, 1.4). retrieval.ts compartido en ese orden.  
- **FASE_2:** ola 1 cursor (2.1, 2.2); ola 2 open_claw (2.3, 2.4). ingest.mjs compartido.  
- **FASE_3:** ola 1 cursor (3.1, 3.2); ola 2 open_claw (3.3, 3.4). reranking.ts compartido.  
- **FASE_4:** ola 1 paralelo (cursor 4.1, open_claw 4.2); ola 2 cursor lider en generation.ts (4.3, 4.5) y open_claw 4.4.  
- **FASE_5:** paralelo total; cursor 5.1, 5.2, 5.4; open_claw 5.3, 5.5. Sin archivos compartidos.

---

## Resumen rápido

| Objetivo | Qué hacer |
|----------|-----------|
| Implementar **una fase** | Usa Opción 1 o 2; adjunta el `.toon` con `@`. |
| **Modo autónomo** (una o todas las fases) | Usa Opción 5; adjunta el .toon; el agente usa autonomo{} instruccion_concreta comando_validacion siguiente_payload. |
| **Cursor y OpenClaw a la vez** (mismo sprint/fase) | Usa Opción 6; ambos cargan el mismo .toon; cada uno sigue instruccion_herramienta[su herramienta] y asignacion_agente; respetar archivos_compartidos y orden. |
| Dejar claro **no tocar docs** | Incluye: "No modifiques los .md en docs/mejoras/". |
| Respetar **orden y criterios** | Di: "Sigue orden_ejecucion y verifica criterio_exito[]". |
| **Empezar desde cero** | Usa FASE_0 primero: `@.../payloads/FASE_0_CORRECCIONES_CRITICAS.toon`. |
| **Encadenar todo** | Usa README_PLAN_MEJORAS.toon (índice) y Opción 5. |

Ruta típica del payload en el repo:  
`ColLawRAG/docs/mejoras/payloads/<NOMBRE_FASE>.toon`

### Campos de los payloads en modo autónomo

| Campo | Uso |
|-------|-----|
| `autonomo{}` | modo, ruta_proyecto, no_modificar, prerequisitos, siguiente_payload, al_fallar |
| `tareas[].instruccion_concreta` | Qué hacer en 1-3 frases; el agente no debe inferir. |
| `tareas[].comando_validacion` | Comando(s) para comprobar que la tarea quedó aplicada. |
| `post_fase_comando[]` | Comandos a ejecutar al cerrar la fase (ej. re-indexar). |
| `siguiente_payload` | Path al .toon de la siguiente fase; "ninguno" si es la última. |
| `al_fallar` | abortar_fase \| reportar_y_continuar si falla validación. |
