import winston from 'winston';

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

const isProduction = process.env.NODE_ENV === 'production';

// JSON format for production, readable for development
const logFormat = isProduction
  ? json()
  : printf(({ level, message, timestamp, stack, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message}`;
  
  // Add stack trace for errors
  if (stack) {
    msg += `\n${stack}`;
  }
  
  // Add metadata if present
  const metadataStr = Object.keys(metadata).length
    ? `\n${JSON.stringify(metadata, null, 2)}`
    : '';
  
  return msg + metadataStr;
});

// Sanitize sensitive data
function sanitizeData(data: any): any {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  const sensitiveKeys = ['password', 'token', 'secret', 'authorization', 'api_key', 'jwt_secret', 'openai_api_key'];
  const sanitized = { ...data };

  for (const key in sanitized) {
    if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object') {
      sanitized[key] = sanitizeData(sanitized[key]);
    }
  }

  return sanitized;
}

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  format: combine(
    winston.format.timestamp(),
    errors({ stack: true }),
    winston.format((info) => {
      // Sanitize sensitive data
      if (info.metadata) {
        info.metadata = sanitizeData(info.metadata);
      }
      const splat = info[Symbol.for('splat')] as unknown[];
      if (splat && Array.isArray(splat)) {
        info[Symbol.for('splat')] = splat.map((item: any) => sanitizeData(item));
      }
      return info;
    })(),
    logFormat
  ),
  defaultMeta: {
    service: 'loyal-supplychain-api',
    environment: process.env.NODE_ENV,
  },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: isProduction
        ? json()
        : combine(
        colorize(),
            printf(({ level, message, timestamp, stack, ...metadata }) => {
              let msg = `${timestamp} [${level}]: ${message}`;
              if (stack) {
                msg += `\n${stack}`;
              }
              const metadataStr = Object.keys(metadata).length
                ? `\n${JSON.stringify(metadata, null, 2)}`
                : '';
              return msg + metadataStr;
            })
      ),
    }),
    // File transport for errors
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: combine(
        timestamp(),
        json()
      ),
    }),
    // File transport for all logs
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: combine(
        timestamp(),
        json()
      ),
    }),
  ],
  // Don't exit on handled exceptions
  exitOnError: false,
});

// Add request ID to logs helper
export function logWithRequestId(requestId: string, level: string, message: string, meta?: any) {
  logger.log(level, message, { requestId, ...meta });
}

export default logger;

