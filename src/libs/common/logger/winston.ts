import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'
import { consoleLogFormat } from './console-log.format'

export interface LoggerConfiguration {
    directory: string
    daysToKeepLogs: string
    fileLogLevel: string
    consoleLogLevel: string
}

export async function createWinstonLogger(config: LoggerConfiguration) {
    const { directory, daysToKeepLogs, fileLogLevel, consoleLogLevel } = config

    const transports: winston.transport[] = []

    transports.push(
        new DailyRotateFile({
            dirname: directory,
            zippedArchive: false,
            maxSize: '10m',
            createSymlink: true,
            format: winston.format.combine(
                winston.format.timestamp({ format: 'HH:mm:ss.SSS' }),
                winston.format.prettyPrint()
            ),
            handleExceptions: true,
            handleRejections: true,
            datePattern: 'YYYY-MM-DD',
            maxFiles: daysToKeepLogs,
            symlinkName: `current.log`,
            filename: `%DATE%.log`,
            level: fileLogLevel
        })
    )

    transports.push(
        new winston.transports.Console({
            format: consoleLogFormat,
            level: consoleLogLevel,
            handleExceptions: true,
            handleRejections: true
        })
    )

    const logger = winston.createLogger({ format: winston.format.json(), transports })

    return logger
}
