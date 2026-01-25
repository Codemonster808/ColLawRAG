/**
 * Structured Logging Utility
 * 
 * Provides structured logging with consistent format for better observability
 * in production environments (Vercel, etc.)
 */

export interface LogContext {
  requestId?: string
  userId?: string
  userTier?: string
  query?: string
  responseTime?: number | string
  responseTimeMs?: number
  [key: string]: any
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

class Logger {
  private formatLog(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString()
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      ...context
    }
    
    // In production, output as JSON for better parsing
    if (process.env.NODE_ENV === 'production') {
      return JSON.stringify(logEntry)
    }
    
    // In development, output as readable format
    const contextStr = context ? ` ${JSON.stringify(context)}` : ''
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`
  }

  debug(message: string, context?: LogContext): void {
    if (process.env.NODE_ENV === 'development' || process.env.LOG_LEVEL === 'debug') {
      console.debug(this.formatLog('debug', message, context))
    }
  }

  info(message: string, context?: LogContext): void {
    console.log(this.formatLog('info', message, context))
  }

  warn(message: string, context?: LogContext): void {
    console.warn(this.formatLog('warn', message, context))
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const errorContext: LogContext = {
      ...context,
      error: error instanceof Error ? {
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        name: error.name
      } : String(error)
    }
    console.error(this.formatLog('error', message, errorContext))
  }

  /**
   * Log API request
   */
  logRequest(method: string, path: string, context?: LogContext): void {
    this.info(`[${method}] ${path}`, context)
  }

  /**
   * Log API response
   */
  logResponse(
    method: string,
    path: string,
    statusCode: number,
    responseTime: number,
    context?: LogContext
  ): void {
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info'
    this[level](`[${method}] ${path} ${statusCode}`, {
      ...context,
      statusCode,
      responseTimeMs: responseTime,
      responseTime: `${responseTime}ms` as string
    })
  }

  /**
   * Log RAG pipeline step
   */
  logPipelineStep(step: string, requestId: string, context?: LogContext): void {
    this.info(`[rag] ${step}`, { requestId, ...context })
  }

  /**
   * Log performance metric
   */
  logMetric(metric: string, value: number, unit: string = 'ms', context?: LogContext): void {
    this.info(`[metric] ${metric}: ${value}${unit}`, context)
  }
}

export const logger = new Logger()
