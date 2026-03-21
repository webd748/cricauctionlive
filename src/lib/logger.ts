type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const shouldLogDebug = process.env.NODE_ENV !== 'production'

function write(level: LogLevel, message: string, meta?: Record<string, unknown>) {
    const payload = meta ? { message, ...meta } : { message }

    if (level === 'debug' && !shouldLogDebug) {
        return
    }

    if (level === 'error') {
        console.error(payload)
        return
    }

    if (level === 'warn') {
        console.warn(payload)
        return
    }

    console.log(payload)
}

export const logger = {
    debug: (message: string, meta?: Record<string, unknown>) => write('debug', message, meta),
    info: (message: string, meta?: Record<string, unknown>) => write('info', message, meta),
    warn: (message: string, meta?: Record<string, unknown>) => write('warn', message, meta),
    error: (message: string, meta?: Record<string, unknown>) => write('error', message, meta),
}
