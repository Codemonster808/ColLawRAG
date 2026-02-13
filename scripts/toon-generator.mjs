#!/usr/bin/env node
/**
 * toon-generator.mjs
 *
 * Generador interactivo de payloads TOON.
 * El usuario describe el propósito y DeepSeek genera el payload óptimo.
 *
 * Modos:
 *   node scripts/toon-generator.mjs              → interactivo
 *   node scripts/toon-generator.mjs --purpose "lista de empleados para análisis de nómina"
 *   node scripts/toon-generator.mjs --json data.json --purpose "contexto RAG jurídico"
 *   node scripts/toon-generator.mjs --purpose "..." --out output.toon
 *   node scripts/toon-generator.mjs --no-llm     → solo con templates locales
 */

import { createInterface } from 'readline';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { encode, decode } from '@toon-format/toon';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ─── Config ───────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const getArg = (f, d) => { const i = args.indexOf(f); return i !== -1 ? args[i + 1] : d; };
const hasFlag = f => args.includes(f);

const HF_KEY = process.env.HUGGINGFACE_API_KEY || (() => {
  try {
    const e = readFileSync(join(ROOT, '.env.local'), 'utf8');
    const m = e.match(/HUGGINGFACE_API_KEY=(.+)/);
    return m ? m[1].trim() : null;
  } catch { return null; }
})();

const MODEL = 'deepseek/deepseek-v3.2';
const ENDPOINT = 'https://router.huggingface.co/novita/v3/openai/chat/completions';
const USE_LLM = !hasFlag('--no-llm') && !!HF_KEY;

// ─── Colores ──────────────────────────────────────────────────────────────────

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m',
  green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m',
  cyan: '\x1b[36m', gray: '\x1b[90m', blue: '\x1b[34m', magenta: '\x1b[35m',
};
const c = (col, t) => `${col}${t}${C.reset}`;
const bold = t => c(C.bold, t);
const green = t => c(C.green, t);
const cyan = t => c(C.cyan, t);
const gray = t => c(C.gray, t);
const yellow = t => c(C.yellow, t);
const magenta = t => c(C.magenta, t);

// ─── Contador de tokens (aprox) ───────────────────────────────────────────────

function tokenCount(text) {
  // GPT tokenizer aproximado: ~4 chars/token en inglés, ~3 en español
  return Math.ceil(text.length / 3.5);
}

function formatSavings(jsonTok, toonTok) {
  const pct = ((jsonTok - toonTok) / jsonTok * 100).toFixed(1);
  const saved = jsonTok - toonTok;
  return { pct, saved };
}

// ─── LLM: Generar payload desde propósito ────────────────────────────────────

async function generateWithLLM(purpose, existingJson = null) {
    const systemPrompt = `Eres un experto en TOON (Token-Oriented Object Notation).

EJEMPLOS EXACTOS de sintaxis TOON:

Objeto simple:
nombre: Ana García
edad: 30
activo: true

Array tabular (la clave del formato):
empleados[3]{id,nombre,cargo,salario}:
  1,Ana García,Desarrolladora,3500000
  2,Carlos López,Diseñador,2800000
  3,María Torres,Gerente,6000000

Array primitivo:
tags[3]: laboral,civil,penal

Objeto con array anidado:
empresa: XYZ S.A.S.
ciudad: Bogotá
empleados[2]{id,nombre,salario}:
  1,Pedro Ruiz,2500000
  2,Laura Vega,3200000

Strings con comas van entre comillas:
empleados[1]{id,descripcion}:
  1,"Desarrollador senior, backend y frontend"

REGLAS:
1. SIEMPRE usa formato tabular para listas de objetos con los mismos campos
2. Omite campos nulos o vacíos
3. Valores booleanos sin comillas: true/false
4. Responde SOLO el bloque TOON puro, sin markdown, sin explicaciones, sin \`\`\``;


  let userMessage;
  if (existingJson) {
    userMessage = `Propósito del payload: "${purpose}"

JSON de entrada a convertir a TOON:
\`\`\`json
${JSON.stringify(existingJson, null, 2).substring(0, 3000)}
\`\`\`

Genera el payload TOON más eficiente posible para este JSON con este propósito.
Responde SOLO con el bloque TOON, sin explicaciones, sin markdown, sin \`\`\`toon.`;
  } else {
    userMessage = `Propósito del payload: "${purpose}"

Genera un payload TOON de ejemplo, realista y útil para este propósito.
Debe tener entre 5 y 20 campos/filas relevantes para el caso de uso.
Usa datos de ejemplo realistas (no "ejemplo1", "valor2").
Responde SOLO con el bloque TOON, sin explicaciones, sin markdown, sin \`\`\`toon.`;
  }

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${HF_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.3,
      max_tokens: 800,
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) throw new Error(`API error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  let content = data.choices?.[0]?.message?.content || '';

  // Limpiar markdown si el modelo los incluyó
  content = content.replace(/^```toon\n?/m, '').replace(/^```\n?/m, '').replace(/```$/m, '').trim();
  return content;
}

// ─── Templates locales (fallback sin LLM) ────────────────────────────────────

const TEMPLATES = {
  empleados: (purpose) => encode({
    proposito: purpose,
    empresa: 'Empresa XYZ S.A.S.',
    fecha: new Date().toISOString().split('T')[0],
    empleados: [
      { id: 1, nombre: 'Ana García', cargo: 'Desarrolladora', salario: 3500000, activo: true },
      { id: 2, nombre: 'Carlos López', cargo: 'Diseñador', salario: 2800000, activo: true },
      { id: 3, nombre: 'María Torres', cargo: 'Gerente', salario: 6000000, activo: true },
    ]
  }),
  productos: (purpose) => encode({
    proposito: purpose,
    catalogo: 'v2024',
    productos: [
      { id: 'P001', nombre: 'Laptop Pro', precio: 3200000, stock: 15, categoria: 'tecnología' },
      { id: 'P002', nombre: 'Mouse Inalámbrico', precio: 85000, stock: 120, categoria: 'periféricos' },
      { id: 'P003', nombre: 'Monitor 27"', precio: 1450000, stock: 8, categoria: 'monitores' },
    ]
  }),
  legal: (purpose) => encode({
    proposito: purpose,
    area: 'laboral',
    fuentes: [
      { id: 1, norma: 'Art. 22 CST', area: 'laboral', vigente: true, texto: 'Contrato de trabajo es aquel por el cual una persona natural se obliga a prestar un servicio personal...' },
      { id: 2, norma: 'Art. 64 CST', area: 'laboral', vigente: true, texto: 'El empleador puede terminar el contrato de trabajo sin justa causa pagando la indemnización correspondiente...' },
    ]
  }),
  metricas: (purpose) => encode({
    proposito: purpose,
    periodo: '2024-Q4',
    metricas: [
      { fecha: '2024-10-01', visitas: 12450, conversiones: 234, ingresos: 4560000, tasa_rebote: 0.42 },
      { fecha: '2024-10-02', visitas: 9820, conversiones: 198, ingresos: 3890000, tasa_rebote: 0.38 },
      { fecha: '2024-10-03', visitas: 15230, conversiones: 312, ingresos: 6120000, tasa_rebote: 0.35 },
    ]
  }),
};

function detectTemplate(purpose) {
  const p = purpose.toLowerCase();
  if (p.match(/emple|nómin|trabajad|rrhh|personal/)) return 'empleados';
  if (p.match(/product|catálog|inventar|tiend/)) return 'productos';
  if (p.match(/legal|jurídic|norma|ley|artícul|rag/)) return 'legal';
  if (p.match(/métric|analític|tráfico|kpi|dato/)) return 'metricas';
  return null;
}

function generateFromTemplate(purpose) {
  const key = detectTemplate(purpose);
  if (key && TEMPLATES[key]) return TEMPLATES[key](purpose);

  // Template genérico
  return encode({
    proposito: purpose,
    generado: new Date().toISOString(),
    datos: [
      { id: 1, campo1: 'valor_ejemplo_1', campo2: 100, activo: true },
      { id: 2, campo1: 'valor_ejemplo_2', campo2: 200, activo: false },
      { id: 3, campo1: 'valor_ejemplo_3', campo2: 300, activo: true },
    ]
  });
}

// ─── Mostrar resultado ────────────────────────────────────────────────────────

function showResult(toonPayload, purpose, sourceJson = null) {
  const toonTok = tokenCount(toonPayload);
  let jsonTok = null;
  let jsonStr = null;

  // Comparar con JSON si hay fuente
  if (sourceJson) {
    jsonStr = JSON.stringify(sourceJson, null, 2);
    jsonTok = tokenCount(jsonStr);
  } else {
    // Intentar decodificar TOON para generar JSON equivalente
    try {
      const decoded = decode(toonPayload);
      jsonStr = JSON.stringify(decoded, null, 2);
      jsonTok = tokenCount(jsonStr);
    } catch {
      jsonTok = Math.ceil(toonTok * 1.67); // estimado típico
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log(bold(cyan('  🎒 PAYLOAD TOON GENERADO')));
  console.log('═'.repeat(60));

  console.log(cyan('\n```toon'));
  console.log(toonPayload);
  console.log(cyan('```'));

  console.log('\n' + '─'.repeat(60));
  console.log(bold('  📊 Comparación de tokens:'));
  console.log(`  🎒 TOON:  ${bold(green(toonTok + ' tokens'))}  (${toonPayload.length} chars)`);
  if (jsonTok) {
    const { pct, saved } = formatSavings(jsonTok, toonTok);
    console.log(`  📄 JSON:  ${jsonTok} tokens  (${jsonStr?.length || '?'} chars)`);
    console.log(`  💰 Ahorro: ${green(bold(pct + '% menos tokens'))} (${saved} tokens ahorrados por llamada)`);

    // Proyección de ahorro a escala
    const costPer1M = 0.27; // USD por 1M tokens (DeepSeek V3.2)
    const savedPerQuery = saved;
    const savedPer1000 = (savedPerQuery * 1000 / 1_000_000 * costPer1M).toFixed(4);
    console.log(`  📈 A 1,000 queries/día: ~${green('$' + savedPer1000)} USD/día ahorrados`);
  }
  console.log('─'.repeat(60));

  // Consejos de optimización
  const lines = toonPayload.split('\n');
  const tabularLines = lines.filter(l => l.match(/\[(\d+)\]\{/)).length;
  if (tabularLines > 0) {
    console.log(green(`  ✓ ${tabularLines} array(s) tabular(es) detectado(s) — formato óptimo`));
  }
  const longValues = toonPayload.split('\n').filter(l => l.length > 120).length;
  if (longValues > 0) {
    console.log(yellow(`  ⚠ ${longValues} línea(s) muy largas — considera truncar textos`));
  }

  console.log('═'.repeat(60));
}

// ─── Input interactivo ────────────────────────────────────────────────────────

function prompt(rl, question) {
  return new Promise(resolve => rl.question(question, resolve));
}

async function interactiveMode() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  console.log('\n' + '═'.repeat(60));
  console.log(bold(cyan('  🎒 Generador de Payloads TOON')));
  console.log(gray('  Token-Oriented Object Notation — 40% menos tokens que JSON'));
  if (USE_LLM) {
    console.log(gray(`  Modelo: ${MODEL}`));
  } else {
    console.log(yellow('  Modo: templates locales (--no-llm o sin API key)'));
  }
  console.log('═'.repeat(60) + '\n');

  // 1. Propósito
  const purpose = await prompt(rl,
    cyan('¿Cuál es el propósito del payload?\n') +
    gray('  Ej: "lista de empleados para análisis de nómina"\n') +
    gray('      "resultados de búsqueda RAG para LLM jurídico"\n') +
    gray('      "métricas de ventas para análisis mensual"\n') +
    '> '
  );

  if (!purpose.trim()) {
    console.log(yellow('  Sin propósito. Saliendo.'));
    rl.close();
    return null;
  }

  // 2. ¿Tiene JSON para convertir?
  let sourceJson = null;
  if (!hasFlag('--no-json')) {
    const hasJson = await prompt(rl,
      cyan('\n¿Tienes un JSON para convertir a TOON? ') + gray('(s/N) ') + '> '
    );

    if (hasJson.trim().toLowerCase() === 's') {
      const jsonPath = await prompt(rl,
        gray('  Ruta al archivo JSON (o pega el JSON directamente):\n') + '> '
      );

      if (existsSync(jsonPath.trim())) {
        try {
          sourceJson = JSON.parse(readFileSync(jsonPath.trim(), 'utf8'));
          console.log(green(`  ✓ JSON cargado: ${Object.keys(sourceJson).length} claves raíz`));
        } catch (e) {
          console.log(yellow(`  ⚠ No se pudo leer el archivo: ${e.message}`));
        }
      } else {
        try {
          sourceJson = JSON.parse(jsonPath.trim());
          console.log(green('  ✓ JSON parseado correctamente'));
        } catch {
          console.log(yellow('  ⚠ JSON inválido, generando desde propósito'));
        }
      }
    }
  }

  // 3. Opciones adicionales
  let extraOptions = '';
  if (USE_LLM) {
    const opts = await prompt(rl,
      cyan('\n¿Alguna restricción o detalle adicional? ') +
      gray('(Enter para omitir)\n') +
      gray('  Ej: "máximo 5 filas", "incluir timestamps", "solo campos esenciales"\n') +
      '> '
    );
    if (opts.trim()) extraOptions = ` Restricción adicional: ${opts.trim()}`;
  }

  rl.close();

  const fullPurpose = purpose.trim() + extraOptions;

  // 4. Generar
  console.log('\n' + gray('  Generando payload TOON...'));
  const spinner = setInterval(() => process.stdout.write(gray('.')), 300);

  try {
    let toonPayload;

    if (USE_LLM) {
      toonPayload = await generateWithLLM(fullPurpose, sourceJson);
    } else {
      if (sourceJson) {
        toonPayload = encode(sourceJson);
      } else {
        toonPayload = generateFromTemplate(fullPurpose);
      }
    }

    clearInterval(spinner);
    console.log(green(' ✓'));

    return { toonPayload, purpose: fullPurpose, sourceJson };
  } catch (err) {
    clearInterval(spinner);
    console.log(yellow(` ⚠ LLM falló (${err.message}), usando template local...`));
    const toonPayload = sourceJson ? encode(sourceJson) : generateFromTemplate(fullPurpose);
    return { toonPayload, purpose: fullPurpose, sourceJson };
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  let purpose = getArg('--purpose', null);
  const jsonPath = getArg('--json', null);
  const outPath = getArg('--out', null);

  let sourceJson = null;
  if (jsonPath) {
    if (!existsSync(jsonPath)) {
      console.error(`\n✗ Archivo no encontrado: ${jsonPath}`);
      process.exit(1);
    }
    sourceJson = JSON.parse(readFileSync(jsonPath, 'utf8'));
  }

  let toonPayload;

  // Modo CLI directo (sin interactividad)
  if (purpose) {
    console.log(gray(`\n  Propósito: "${purpose}"`));
    process.stdout.write(gray('  Generando'));
    const spinner = setInterval(() => process.stdout.write(gray('.')), 300);

    try {
      if (USE_LLM) {
        toonPayload = await generateWithLLM(purpose, sourceJson);
      } else {
        toonPayload = sourceJson ? encode(sourceJson) : generateFromTemplate(purpose);
      }
    } catch (err) {
      console.log(yellow(` ⚠ ${err.message}, usando template...`));
      toonPayload = sourceJson ? encode(sourceJson) : generateFromTemplate(purpose);
    }

    clearInterval(spinner);
    console.log(green(' ✓'));
  } else {
    // Modo interactivo
    const result = await interactiveMode();
    if (!result) return;
    ({ toonPayload, purpose, sourceJson } = result);
  }

  // Mostrar resultado
  showResult(toonPayload, purpose, sourceJson);

  // Guardar si se pidió
  if (outPath) {
    writeFileSync(outPath, toonPayload);
    console.log(green(`\n  ✓ Guardado en: ${outPath}`));
  } else {
    console.log(gray('\n  Tip: usa --out archivo.toon para guardar el resultado'));
  }
}

main().catch(err => {
  console.error(`\n✗ Error: ${err.message}`);
  process.exit(1);
});
