#!/usr/bin/env node
/**
 * Script para corregir URLs en metadata.json
 * 
 * Problema: URLs tienen año completo (2024) en lugar de año corto (24)
 * Correcto: https://www.corteconstitucional.gov.co/relatoria/2024/T-001-24.htm
 * Incorrecto: https://www.corteconstitucional.gov.co/relatoria/2024/T-001-2024.htm
 */

import { readFile, writeFile } from 'fs/promises';
import path from 'path';

const METADATA_PATH = path.join(process.cwd(), 'data', 'jurisprudencia', 'cc', 'metadata.json');

async function fixUrls() {
  console.log('\n========================================');
  console.log('CORRECTOR DE URLs EN METADATA');
  console.log('========================================\n');
  
  // Leer metadata
  const content = await readFile(METADATA_PATH, 'utf-8');
  const metadata = JSON.parse(content);
  
  console.log(`[INFO] Cargadas ${Object.keys(metadata).length} entradas\n`);
  
  let corrected = 0;
  let alreadyCorrect = 0;
  
  // Iterar y corregir
  for (const [id, data] of Object.entries(metadata)) {
    const oldUrl = data.url;
    
    // Extraer partes de la URL
    // Formato: https://www.corteconstitucional.gov.co/relatoria/2024/T-001-2024.htm
    const match = oldUrl.match(/relatoria\/(\d{4})\/(.*)-(\d{2,4})\.htm$/);
    
    if (!match) {
      console.warn(`[WARN] No se pudo parsear URL: ${oldUrl}`);
      continue;
    }
    
    const [_, yearDir, prefix, yearSuffix] = match;
    
    // Si el sufijo ya es de 2 dígitos, skip
    if (yearSuffix.length === 2) {
      alreadyCorrect++;
      continue;
    }
    
    // Corregir: usar solo últimos 2 dígitos del año
    const yearShort = yearSuffix.slice(-2);
    const newUrl = `https://www.corteconstitucional.gov.co/relatoria/${yearDir}/${prefix}-${yearShort}.htm`;
    
    metadata[id].url = newUrl;
    corrected++;
    
    if (corrected <= 5) {
      console.log(`[FIX] ${id}`);
      console.log(`  Antes: ${oldUrl}`);
      console.log(`  Después: ${newUrl}\n`);
    }
  }
  
  // Guardar metadata corregido
  await writeFile(METADATA_PATH, JSON.stringify(metadata, null, 2), 'utf-8');
  
  console.log(`\n[SAVED] Metadata corregido: ${METADATA_PATH}`);
  console.log(`\nEstadísticas:`);
  console.log(`  Total: ${Object.keys(metadata).length}`);
  console.log(`  Corregidas: ${corrected}`);
  console.log(`  Ya correctas: ${alreadyCorrect}`);
  
  console.log('\n========================================');
  console.log('CORRECCIÓN COMPLETADA');
  console.log('========================================\n');
}

fixUrls().catch(console.error);
