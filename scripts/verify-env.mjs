#!/usr/bin/env node
/**
 * Script para verificar variables de entorno requeridas
 * Ejecutar antes de hacer deploy para asegurar que todo está configurado
 */

const requiredVars = [
  {
    name: 'HUGGINGFACE_API_KEY',
    required: true,
    description: 'API key de Hugging Face (obtener en https://huggingface.co/settings/tokens)',
    validate: (value) => value && value.startsWith('hf_')
  },
  {
    name: 'HF_EMBEDDING_MODEL',
    required: false,
    description: 'Modelo de embeddings (default: sentence-transformers/paraphrase-multilingual-mpnet-base-v2)',
    default: 'sentence-transformers/paraphrase-multilingual-mpnet-base-v2'
  },
  {
    name: 'HF_GENERATION_MODEL',
    required: false,
    description: 'Modelo de generación (default: mistralai/Mistral-7B-Instruct-v0.3)',
    default: 'mistralai/Mistral-7B-Instruct-v0.3'
  },
  {
    name: 'EMB_PROVIDER',
    required: false,
    description: 'Proveedor de embeddings (default: hf)',
    default: 'hf'
  },
  {
    name: 'GEN_PROVIDER',
    required: false,
    description: 'Proveedor de generación (default: hf)',
    default: 'hf'
  }
]

const optionalVars = [
  {
    name: 'RAG_API_KEY',
    description: 'API key para proteger el endpoint (opcional)'
  },
  {
    name: 'RATE_LIMIT_REQUESTS',
    description: 'Límite de requests por minuto (default: 10)',
    default: '10'
  },
  {
    name: 'RATE_LIMIT_WINDOW_MS',
    description: 'Ventana de tiempo para rate limiting en ms (default: 60000)',
    default: '60000'
  },
  {
    name: 'PIPELINE_TIMEOUT_MS',
    description: 'Timeout del pipeline en ms (default: 60000)',
    default: '60000'
  },
  {
    name: 'HF_API_TIMEOUT_MS',
    description: 'Timeout de API de Hugging Face en ms (default: 30000)',
    default: '30000'
  },
  {
    name: 'MAX_REQUEST_SIZE',
    description: 'Tamaño máximo de request en bytes (default: 1048576)',
    default: '1048576'
  },
  {
    name: 'ALLOWED_ORIGINS',
    description: 'Orígenes permitidos para CORS (default: *)',
    default: '*'
  }
]

function checkEnvVar(varConfig) {
  const value = process.env[varConfig.name]
  const isSet = value !== undefined && value !== ''
  
  if (varConfig.required) {
    if (!isSet) {
      return {
        status: 'missing',
        message: `❌ REQUERIDA pero no configurada: ${varConfig.name}`
      }
    }
    
    if (varConfig.validate && !varConfig.validate(value)) {
      return {
        status: 'invalid',
        message: `⚠️  ${varConfig.name} tiene formato inválido`
      }
    }
    
    return {
      status: 'ok',
      message: `✅ ${varConfig.name}: Configurada`
    }
  } else {
    if (isSet) {
      return {
        status: 'ok',
        message: `✅ ${varConfig.name}: ${value}`
      }
    } else {
      return {
        status: 'default',
        message: `ℹ️  ${varConfig.name}: No configurada (usará default: ${varConfig.default})`
      }
    }
  }
}

function main() {
  console.log('='.repeat(80))
  console.log('VERIFICACIÓN DE VARIABLES DE ENTORNO')
  console.log('='.repeat(80))
  console.log()
  
  let hasErrors = false
  let hasWarnings = false
  
  // Verificar variables requeridas
  console.log('📋 VARIABLES REQUERIDAS:')
  console.log('-'.repeat(80))
  
  for (const varConfig of requiredVars) {
    const result = checkEnvVar(varConfig)
    console.log(result.message)
    
    if (result.status === 'missing') {
      hasErrors = true
      console.log(`   Descripción: ${varConfig.description}`)
    } else if (result.status === 'invalid') {
      hasWarnings = true
      console.log(`   Descripción: ${varConfig.description}`)
    }
  }
  
  console.log()
  console.log('📋 VARIABLES OPCIONALES:')
  console.log('-'.repeat(80))
  
  for (const varConfig of optionalVars) {
    const result = checkEnvVar(varConfig)
    console.log(result.message)
  }
  
  console.log()
  console.log('='.repeat(80))
  
  // Verificar archivos importantes
  console.log('📁 VERIFICACIÓN DE ARCHIVOS:')
  console.log('-'.repeat(80))
  
  const fs = await import('fs')
  const path = await import('path')
  const { fileURLToPath } = await import('url')
  
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)
  const projectRoot = path.join(__dirname, '..')
  
  const indexPath = path.join(projectRoot, 'data', 'index.json')
  if (fs.existsSync(indexPath)) {
    const stats = fs.statSync(indexPath)
    console.log(`✅ data/index.json existe (${(stats.size / 1024 / 1024).toFixed(2)} MB)`)
    
    try {
      const content = fs.readFileSync(indexPath, 'utf-8')
      JSON.parse(content)
      console.log('✅ data/index.json es JSON válido')
    } catch (e) {
      console.log('❌ data/index.json no es JSON válido')
      hasErrors = true
    }
  } else {
    console.log('❌ data/index.json no existe. Ejecuta: npm run ingest')
    hasErrors = true
  }
  
  console.log()
  console.log('='.repeat(80))
  
  // Resumen final
  if (hasErrors) {
    console.log('❌ ERRORES ENCONTRADOS:')
    console.log('   Por favor, configura las variables requeridas antes de hacer deploy.')
    console.log()
    console.log('   Para configurar en Vercel:')
    console.log('   1. Ve a https://vercel.com/dashboard')
    console.log('   2. Selecciona tu proyecto')
    console.log('   3. Settings → Environment Variables')
    console.log('   4. Agrega las variables requeridas')
    console.log('   5. Aplica a Production y Preview')
    process.exit(1)
  } else if (hasWarnings) {
    console.log('⚠️  ADVERTENCIAS ENCONTRADAS:')
    console.log('   Revisa las variables con formato inválido.')
    process.exit(0)
  } else {
    console.log('✅ TODAS LAS VERIFICACIONES PASARON')
    console.log('   El proyecto está listo para hacer deploy.')
    process.exit(0)
  }
}

main().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})
