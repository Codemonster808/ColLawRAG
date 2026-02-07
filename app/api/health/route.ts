import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export const runtime = 'nodejs'

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  checks: {
    indexFile: {
      status: 'ok' | 'error'
      message?: string
    }
    huggingFace: {
      status: 'ok' | 'error'
      message?: string
    }
  }
  version?: string
}

async function checkHuggingFace(): Promise<{ status: 'ok' | 'error'; message?: string }> {
  const apiKey = process.env.HUGGINGFACE_API_KEY
  
  if (!apiKey) {
    return {
      status: 'error',
      message: 'HUGGINGFACE_API_KEY not configured'
    }
  }
  
  try {
    // Simple check: verify the API key format (starts with hf_)
    if (!apiKey.startsWith('hf_')) {
      return {
        status: 'error',
        message: 'Invalid HUGGINGFACE_API_KEY format'
      }
    }
    
    // Optional: Make a lightweight API call to verify connectivity
    // For now, we'll just check the format to avoid unnecessary API calls
    return {
      status: 'ok'
    }
  } catch (error: any) {
    return {
      status: 'error',
      message: error.message || 'Hugging Face API check failed'
    }
  }
}

function checkIndexFile(): { status: 'ok' | 'error'; message?: string } {
  try {
    const indexPath = path.join(process.cwd(), 'data', 'index.json')
    const gzPath = indexPath + '.gz'
    
    // Verificar si existe el archivo descomprimido O el comprimido (.gz)
    const jsonExists = fs.existsSync(indexPath)
    const gzExists = fs.existsSync(gzPath)
    
    if (!jsonExists && !gzExists) {
      return {
        status: 'error',
        message: 'data/index.json and data/index.json.gz not found'
      }
    }
    
    if (jsonExists) {
      const stats = fs.statSync(indexPath)
      if (stats.size === 0) {
        return {
          status: 'error',
          message: 'data/index.json is empty'
        }
      }
    }
    
    if (!jsonExists && gzExists) {
      const stats = fs.statSync(gzPath)
      if (stats.size === 0) {
        return {
          status: 'error',
          message: 'data/index.json.gz is empty'
        }
      }
      return {
        status: 'ok',
        message: `index.json.gz present (${(stats.size / (1024 * 1024)).toFixed(1)} MB, will decompress at runtime)`
      }
    }
    
    return {
      status: 'ok'
    }
  } catch (error: any) {
    return {
      status: 'error',
      message: error.message || 'Index file check failed'
    }
  }
}

export async function GET() {
  const checks = {
    indexFile: checkIndexFile(),
    huggingFace: await checkHuggingFace()
  }
  
  const allOk = checks.indexFile.status === 'ok' && checks.huggingFace.status === 'ok'
  const anyError = checks.indexFile.status === 'error' || checks.huggingFace.status === 'error'
  
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy'
  if (allOk) {
    overallStatus = 'healthy'
  } else if (checks.huggingFace.status === 'error' && checks.indexFile.status === 'ok') {
    overallStatus = 'degraded' // Can still serve cached/indexed content
  } else {
    overallStatus = 'unhealthy'
  }
  
  const healthStatus: HealthStatus = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    checks,
    version: process.env.npm_package_version || '1.0.0'
  }
  
  const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503
  
  return NextResponse.json(healthStatus, { 
    status: statusCode,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  })
}
