import { NextRequest, NextResponse } from 'next/server'
import puppeteer from 'puppeteer'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { query, answer, citations, calculations, vigenciaValidation, procedures } = body

    if (!answer) {
      return NextResponse.json({ error: 'No hay respuesta para exportar' }, { status: 400 })
    }

    // Generar HTML del PDF
    const html = generatePDFHTML({
      query,
      answer,
      citations: citations || [],
      calculations: calculations || [],
      vigenciaValidation: vigenciaValidation || null,
      procedures: procedures || [],
      date: new Date().toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
    })

    // Generar PDF con Puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    const pdf = await page.pdf({
      format: 'A4',
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm',
      },
      printBackground: true,
    })
    await browser.close()

    // Retornar PDF
    return new NextResponse(pdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="consulta-legal-${Date.now()}.pdf"`,
      },
    })
  } catch (error) {
    console.error('Error generando PDF:', error)
    return NextResponse.json(
      { error: 'Error al generar PDF', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

function generatePDFHTML({
  query,
  answer,
  citations,
  calculations,
  vigenciaValidation,
  procedures,
  date,
}: {
  query: string
  answer: string
  citations: Array<{ id: string; title: string; type: string; url?: string; article?: string }>
  calculations: Array<{ type: string; amount: number; formula: string; breakdown: Record<string, number | string> }>
  vigenciaValidation: { warnings: string[]; byNorma: Array<{ normaId: string; title: string; estado: string }> } | null
  procedures: Array<{ id: string; nombre: string; tipo?: string; resumen?: string }>
  date: string
}) {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Consulta Legal - ColLawRAG</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      padding: 20px;
      background: #fff;
    }
    .header {
      border-bottom: 3px solid #2563eb;
      padding-bottom: 15px;
      margin-bottom: 30px;
    }
    .header h1 {
      color: #2563eb;
      font-size: 24px;
      margin-bottom: 5px;
    }
    .header .date {
      color: #666;
      font-size: 12px;
    }
    .section {
      margin-bottom: 25px;
    }
    .section-title {
      font-size: 18px;
      font-weight: bold;
      color: #1e40af;
      margin-bottom: 10px;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 5px;
    }
    .query {
      background: #f3f4f6;
      padding: 15px;
      border-radius: 5px;
      border-left: 4px solid #2563eb;
      margin-bottom: 20px;
    }
    .query-label {
      font-weight: bold;
      color: #374151;
      margin-bottom: 5px;
      font-size: 12px;
      text-transform: uppercase;
    }
    .query-text {
      color: #111827;
      font-size: 14px;
    }
    .answer {
      white-space: pre-wrap;
      line-height: 1.8;
      font-size: 13px;
      color: #374151;
    }
    .citations {
      margin-top: 20px;
    }
    .citations ul {
      list-style: none;
      padding-left: 0;
    }
    .citations li {
      margin-bottom: 8px;
      padding-left: 20px;
      position: relative;
      font-size: 12px;
    }
    .citations li:before {
      content: counter(citation-counter) '.';
      counter-increment: citation-counter;
      position: absolute;
      left: 0;
      font-weight: bold;
      color: #2563eb;
    }
    .citations {
      counter-reset: citation-counter;
    }
    .citation-title {
      font-weight: 600;
      color: #1e40af;
    }
    .citation-article {
      color: #6b7280;
    }
    .calculations {
      margin-top: 20px;
    }
    .calculation-item {
      background: #f9fafb;
      padding: 12px;
      border-radius: 5px;
      margin-bottom: 10px;
      border-left: 3px solid #10b981;
    }
    .calculation-type {
      font-weight: bold;
      color: #059669;
      margin-bottom: 5px;
    }
    .calculation-amount {
      font-size: 18px;
      font-weight: bold;
      color: #047857;
    }
    .calculation-formula {
      font-size: 11px;
      color: #6b7280;
      margin-top: 5px;
    }
    .vigencia-warnings {
      margin-top: 20px;
    }
    .warning {
      background: #fef3c7;
      border-left: 3px solid #f59e0b;
      padding: 10px;
      margin-bottom: 8px;
      font-size: 12px;
      color: #92400e;
    }
    .procedures {
      margin-top: 20px;
    }
    .procedure-item {
      background: #eff6ff;
      padding: 10px;
      border-radius: 5px;
      margin-bottom: 8px;
      border-left: 3px solid #3b82f6;
    }
    .procedure-name {
      font-weight: bold;
      color: #1e40af;
      margin-bottom: 3px;
    }
    .procedure-type {
      font-size: 11px;
      color: #6b7280;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #e5e7eb;
      font-size: 11px;
      color: #6b7280;
      text-align: center;
    }
    .disclaimer {
      background: #fef2f2;
      border: 1px solid #fecaca;
      padding: 12px;
      border-radius: 5px;
      margin-top: 20px;
      font-size: 11px;
      color: #991b1b;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>ColLawRAG - Consulta Legal</h1>
    <div class="date">Generado el ${date}</div>
  </div>

  <div class="section">
    <div class="query">
      <div class="query-label">Consulta</div>
      <div class="query-text">${escapeHtml(query)}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Respuesta</div>
    <div class="answer">${escapeHtml(answer)}</div>
  </div>

  ${procedures.length > 0 ? `
  <div class="section procedures">
    <div class="section-title">Procedimientos Identificados</div>
    ${procedures.map((p) => `
      <div class="procedure-item">
        <div class="procedure-name">${escapeHtml(p.nombre)}</div>
        ${p.tipo ? `<div class="procedure-type">Tipo: ${escapeHtml(p.tipo)}</div>` : ''}
        ${p.resumen ? `<div style="margin-top: 5px; font-size: 11px; color: #4b5563;">${escapeHtml(p.resumen)}</div>` : ''}
      </div>
    `).join('')}
  </div>
  ` : ''}

  ${calculations.length > 0 ? `
  <div class="section calculations">
    <div class="section-title">Cálculos</div>
    ${calculations.map((calc) => `
      <div class="calculation-item">
        <div class="calculation-type">${escapeHtml(calc.type)}</div>
        <div class="calculation-amount">$${calc.amount.toLocaleString('es-CO')}</div>
        ${calc.formula ? `<div class="calculation-formula">Fórmula: ${escapeHtml(calc.formula)}</div>` : ''}
      </div>
    `).join('')}
  </div>
  ` : ''}

  ${vigenciaValidation && (vigenciaValidation.warnings.length > 0 || vigenciaValidation.byNorma.length > 0) ? `
  <div class="section vigencia-warnings">
    <div class="section-title">Advertencias de Vigencia</div>
    ${vigenciaValidation.warnings.map((w) => `
      <div class="warning">⚠️ ${escapeHtml(w)}</div>
    `).join('')}
  </div>
  ` : ''}

  ${citations.length > 0 ? `
  <div class="section citations">
    <div class="section-title">Fuentes y Referencias</div>
    <ul>
      ${citations.map((c, i) => `
        <li>
          <span class="citation-title">${escapeHtml(c.title)}</span>
          ${c.article ? `<span class="citation-article"> — ${escapeHtml(c.article)}</span>` : ''}
          ${c.type ? `<span style="color: #9ca3af; font-size: 11px;"> (${escapeHtml(c.type)})</span>` : ''}
        </li>
      `).join('')}
    </ul>
  </div>
  ` : ''}

  <div class="disclaimer">
    <strong>⚠️ Aviso Legal:</strong> Este documento es informativo y no constituye asesoría legal profesional. 
    Las respuestas generadas por ColLawRAG son basadas en información disponible y no reemplazan la consulta 
    con un abogado calificado. Verifique la vigencia de las normas citadas y consulte con un profesional 
    para asuntos legales específicos.
  </div>

  <div class="footer">
    <p>Generado por ColLawRAG - Sistema de Consulta Legal con IA</p>
    <p>https://col-law-rag.vercel.app</p>
  </div>
</body>
</html>
  `
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }
  return text.replace(/[&<>"']/g, (m) => map[m])
}
