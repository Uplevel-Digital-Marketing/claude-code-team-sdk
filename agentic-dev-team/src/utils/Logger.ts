import winston from 'winston';
import path from 'path';

export class Logger {
  private logger: winston.Logger;

  constructor(component: string) {
    const logLevel = process.env.LOG_LEVEL || 'info';
    const workspace = process.env.TEAM_WORKSPACE || './workspace';

    this.logger = winston.createLogger({
      level: logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
          let log = `${timestamp} [${component}] ${level.toUpperCase()}: ${message}`;

          // Add metadata if present
          if (Object.keys(meta).length > 0) {
            log += ` ${JSON.stringify(meta)}`;
          }

          // Add stack trace for errors
          if (stack) {
            log += `\n${stack}`;
          }

          return log;
        })
      ),
      transports: [
        // Console output
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        }),

        // File output
        new winston.transports.File({
          filename: path.join(workspace, 'logs', 'error.log'),
          level: 'error'
        }),

        new winston.transports.File({
          filename: path.join(workspace, 'logs', 'combined.log')
        })
      ]
    });
  }

  debug(message: string, meta?: any): void {
    this.logger.debug(message, meta);
  }

  info(message: string, meta?: any): void {
    this.logger.info(message, meta);
  }

  warn(message: string, meta?: any): void {
    this.logger.warn(message, meta);
  }

  error(message: string, error?: Error | any): void {
    if (error instanceof Error) {
      this.logger.error(message, { error: error.message, stack: error.stack });
    } else {
      this.logger.error(message, error);
    }
  }

  child(childComponent: string): Logger {
    // Create a child logger with extended component name
    return new Logger(`${this.getComponent()}.${childComponent}`);
  }

  private getComponent(): string {
    // Extract component name from the logger's format
    return 'Component'; // This would need to be stored in the instance
  }
}