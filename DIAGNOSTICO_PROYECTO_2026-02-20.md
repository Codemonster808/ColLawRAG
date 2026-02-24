# Diagnóstico del proyecto — ColLawRAG (estado actual)
**Fecha:** 2026-02-20  
**Incluye:** Estado del proyecto + resumen de logs ClawdBot/OpenClaw

---

## 1. Resumen de logs ClawdBot / OpenClaw

**Archivo revisado:** `clawdbot/data/openclaw-refresh.log` y `ColLawRAG/data/openclaw-refresh.log`

- **Qué hace el log:** Registra el script que refresca el token de OpenClaw y reinicia el gateway cada 6 horas (cron).
- **Últimas entradas:** 2026-02-20 12:02. Todas las entradas recientes muestran:
  - `✅ Token de Claude copiado a OpenClaw (origen: .../clawdbot/data/claude-api-token.txt)`
  - `Gateway restarted (PID ...)`
- **Errores:** Ninguno reciente. Una vez (2026-02-09 18:00) apareció `❌ No se encontró: .../.credentials.json`; desde entonces el origen del token es `claude-api-token.txt` y el refresh funciona.
- **Nota:** ClawdBot **no está usando Anthropic** como modelo en este momento; usa un modelo de menos parámetros. Los payloads para ClawdBot deben ser **muy explícitos y paso a paso** para que ese modelo pueda ejecutar las tareas sin inferir.

---

## 2. Estado actual del proyecto ColLawRAG

| Aspecto | Estado |
|--------|--------|
| **Problema raíz** | Documentos: formato inconsistente, metadata no extraída, parte del corpus mock/sintético. Ver `DIAGNOSTICO_DOCUMENTOS_2026-02-18.md`. |
| **Ingest** | Mejorado: parsea cabecera alternativa (Tema:/Tipo:/======) y strip por `========================================`. |
| **Documentos** | ~744 .txt en `data/documents/`. Re-ingesta pendiente para aplicar mejor metadata. |
| **Tareas Cursor** | CU-00 a CU-10 completadas. Sprint 1–3 hechos; Sprint 4 (accuracy avanzado) en curso. |
| **Tareas ClawdBot** | 7/7 completadas (Tareas 5, 6, 10, 10A, 11, 13, 14). Sin tareas pendientes asignadas. |
| **Producción** | https://col-law-rag.vercel.app |
| **Payloads** | Cursor: `TAREAS_CURSOR.toon`. ClawdBot: `plan-colaw/PAYLOAD_CLAWDBOT_AUTONOMO.txt` y **`plan-colaw/PAYLOAD_CLAWDBOT_PASO_A_PASO.txt`** (para modelo con menos parámetros). |
| **Bugs resueltos** | `plan-colaw/bugs-resueltos/` — Cursor y OpenClaw deben **revisar antes de implementar** (INDEX.md + CURSOR/ o CLAWDBOT/) y documentar ahí los fixes. |

---

## 3. Próximos pasos recomendados

1. **Re-ingesta:** En ColLawRAG ejecutar `npm run ingest` y `npm run build-bm25` (requiere env con API de embeddings).
2. **Medir:** Ejecutar `node scripts/evaluate-accuracy.mjs` y anotar % accuracy y % chunks con área.
3. **Documentos reales:** Sustituir/ampliar mocks con textos de fuentes oficiales (plan Claude Chrome o descarga manual).
4. **ClawdBot:** Usar `PAYLOAD_CLAWDBOT_PASO_A_PASO.txt` cuando el agente use un modelo con menos parámetros; las tareas están escritas en pasos numerados y comandos exactos.
5. **Benchmark:** Ver `DIAGNOSTICO_BENCHMARK_2026-02-20.md`. RAG prod OK; juez (Ollama) debe estar disponible. Tareas: OC-A0 (juez), OC-A1 (baseline), OC-A2 (re-ingesta), OC-A3 (post-fix).
6. **OpenClaw pausado** hasta recarga de tokens semanales. Mientras tanto, **Cursor** usa el payload en formato toon con todas las tareas: `plan-colaw/PAYLOAD_CURSOR_TOON.toon` (CU-* completadas + OC-A0..OC-A3 pendientes).
