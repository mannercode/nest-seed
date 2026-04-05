/* istanbul ignore file */
import { styleText } from 'node:util'
import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'
import type { HttpErrorLog, HttpSuccessLog } from './types'
import { defaultTo } from '../utils'

function colorizeHttpMethod(method: string | undefined) {
    const normalizedMethod = defaultTo(method, 'METHOD').toUpperCase()

    switch (normalizedMethod) {
        case 'DELETE':
            return styleText('red', normalizedMethod)
        case 'GET':
            return styleText('cyan', normalizedMethod)
        case 'PATCH':
            return styleText('blueBright', normalizedMethod)
        case 'POST':
            return styleText('yellow', normalizedMethod)
        case 'PUT':
            return styleText('blue', normalizedMethod)
        default:
            return styleText('magenta', normalizedMethod)
    }
}

function colorizeLogLevel(level: string | undefined) {
    const normalizedLevel = defaultTo(level, 'LEVEL').toUpperCase()

    switch (normalizedLevel) {
        case 'ERROR':
            return styleText('red', normalizedLevel)
        case 'INFO':
            return styleText('cyan', normalizedLevel)
        case 'WARN':
            return styleText('yellow', normalizedLevel)
        default:
            return styleText('gray', normalizedLevel)
    }
}

function formatServiceLogMessage(
    message: string,
    level: string,
    timestamp: string,
    logDetails: Record<string, unknown>
) {
    const { contextType: _, ...data } = logDetails
    const coloredData = styleText('blueBright', JSON.stringify(data, null, 2))

    return `${timestamp} ${level} SERVICE ${message} ${coloredData}`
}

function formatGenericLogMessage(
    message: string,
    level: string,
    timestamp: string,
    logDetails: unknown
) {
    const coloredEtc = styleText('blueBright', JSON.stringify(logDetails, null, 2))

    return `${timestamp} ${level} ${message} ${coloredEtc}`
}

function formatHttpLogMessage(
    message: string,
    level: string,
    timestamp: string,
    logDetails: HttpErrorLog | HttpSuccessLog
) {
    const statusCode = styleText('magenta', `${logDetails.statusCode}`)
    const { request } = logDetails
    const method = colorizeHttpMethod(request.method)
    const url = styleText('green', request.url)
    const nativeBody = defaultTo(request.body, {})
    const body = styleText('blueBright', JSON.stringify(nativeBody, null, 2))

    return `${timestamp} ${level} HTTP ${message} ${statusCode} ${method} ${url} ${body} `
}

export type LogFormatter = (
    message: string,
    level: string,
    timestamp: string,
    logDetails: any
) => string

export type LoggerConfig = {
    consoleLogLevel: string
    customFormatters?: Record<string, LogFormatter>
    daysToKeepLogs: string
    directory: string
    fileLogLevel: string
}

function createConsoleLogFormat(customFormatters?: Record<string, LogFormatter>) {
    return winston.format.combine(
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        winston.format.printf((info) => {
            const { level, message, timestamp, ...rest } = info

            const coloredMessage = styleText('white', String(message))
            const coloredLevel = colorizeLogLevel(level)
            const coloredTimestamp = styleText('gray', String(timestamp))
            const logDetails = rest as any
            const contextType = logDetails?.contextType

            const customFormatter = customFormatters?.[contextType]
            if (customFormatter) {
                return customFormatter(coloredMessage, coloredLevel, coloredTimestamp, logDetails)
            }

            if (contextType === 'http') {
                return formatHttpLogMessage(
                    coloredMessage,
                    coloredLevel,
                    coloredTimestamp,
                    logDetails
                )
            } else if (contextType === 'service') {
                return formatServiceLogMessage(
                    coloredMessage,
                    coloredLevel,
                    coloredTimestamp,
                    logDetails
                )
            } else {
                return formatGenericLogMessage(
                    coloredMessage,
                    coloredLevel,
                    coloredTimestamp,
                    logDetails
                )
            }
        })
    )
}

export function createWinstonLogger(config: LoggerConfig) {
    const { consoleLogLevel, customFormatters, daysToKeepLogs, directory, fileLogLevel } = config

    const transports: winston.transport[] = []

    transports.push(
        new DailyRotateFile({
            createSymlink: true,
            datePattern: 'YYYY-MM-DD',
            dirname: directory,
            filename: `%DATE%.log`,
            format: winston.format.combine(
                winston.format.timestamp({ format: 'HH:mm:ss.SSS' }),
                winston.format.json()
            ),
            handleExceptions: true,
            handleRejections: true,
            level: fileLogLevel,
            maxFiles: daysToKeepLogs,
            maxSize: '10m',
            symlinkName: `current.log`,
            zippedArchive: false
        })
    )

    if (consoleLogLevel && consoleLogLevel !== 'silent') {
        transports.push(
            new winston.transports.Console({
                format: createConsoleLogFormat(customFormatters),
                handleExceptions: true,
                handleRejections: true,
                level: consoleLogLevel
            })
        )
    }

    const logger = winston.createLogger({ format: winston.format.json(), transports })
    return logger
}
