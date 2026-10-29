export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export type Logger = Record<LogLevel, (message: string, fields?: Record<string, unknown>) => void> & {
  child: (fields: Record<string, unknown>) => Logger
}

type LogWriter = (level: LogLevel, message: string, fields: Record<string, unknown>) => void

function makeLogger(write: LogWriter, base: Record<string, unknown>): Logger {
  const logger: Logger = {
    debug: (message, fields) => write('debug', message, { ...base, ...fields }),
    info: (message, fields) => write('info', message, { ...base, ...fields }),
    warn: (message, fields) => write('warn', message, { ...base, ...fields }),
    error: (message, fields) => write('error', message, { ...base, ...fields }),
    child: (fields) => makeLogger(write, { ...base, ...fields }),
  }
  return logger
}

function consoleWriter(level: LogLevel, message: string, fields: Record<string, unknown>): void {
  console[level](JSON.stringify({ level, msg: message, ...fields, time: new Date().toISOString() }))
}

export function createLogger(options?: { sink?: Logger; baseFields?: Record<string, unknown> }): Logger {
  const base = options?.baseFields ?? {}
  if (options?.sink) {
    const sink = options.sink
    return makeLogger((level, message, fields) => sink[level](message, fields), base)
  }
  return makeLogger(consoleWriter, base)
}

let requestLogger: Logger | null = null

export function getRequestLogger(): Logger {
  if (!requestLogger) {
    requestLogger = createLogger()
  }
  return requestLogger
}
