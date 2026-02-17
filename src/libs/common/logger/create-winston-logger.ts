/* istanbul ignore file */
import { defaultTo } from 'lodash'
import { styleText } from 'node:util'
import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'
import type { HttpErrorLog, HttpSuccessLog, RpcErrorLog, RpcSuccessLog } from './types'

function colorizeHttpMethod(method: string | undefined) {
    const METHOD = defaultTo(method, 'METHOD').toUpperCase()

    switch (METHOD) {
        case 'GET':
            return styleText('cyan', METHOD)
        case 'POST':
            return styleText('yellow', METHOD)
        case 'PUT':
            return styleText('blue', METHOD)
        case 'PATCH':
            return styleText('blueBright', METHOD)
        case 'DELETE':
            return styleText('red', METHOD)
        default:
            return styleText('magenta', METHOD)
    }
}

function colorizeLogLevel(level: string | undefined) {
    const LEVEL = defaultTo(level, 'LEVEL').toUpperCase()

    switch (LEVEL) {
        case 'ERROR':
            return styleText('red', LEVEL)
        case 'WARN':
            return styleText('yellow', LEVEL)
        case 'INFO':
            return styleText('cyan', LEVEL)
        default:
            return styleText('gray', LEVEL)
    }
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

function formatRpcLogMessage(
    message: string,
    level: string,
    timestamp: string,
    logDetails: RpcErrorLog | RpcSuccessLog
) {
    const coloredContext = styleText('magenta', JSON.stringify(logDetails.context, null, 2))
    const coloredData = styleText('blueBright', JSON.stringify(logDetails.data, null, 2))

    return `${timestamp} ${level} RPC ${message} ${coloredContext} ${coloredData}`
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

const consoleLogFormat = winston.format.combine(
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.printf((info) => {
        const { message, level, timestamp, ...rest } = info

        const coloredMessage = styleText('white', String(message))
        const coloredLevel = colorizeLogLevel(level)
        const coloredTimestamp = styleText('gray', String(timestamp))
        const logDetails = rest[0] as any

        if (logDetails?.contextType === 'http') {
            return formatHttpLogMessage(coloredMessage, coloredLevel, coloredTimestamp, logDetails)
        } else if (logDetails?.contextType === 'rpc') {
            return formatRpcLogMessage(coloredMessage, coloredLevel, coloredTimestamp, logDetails)
        } else {
            return formatGenericLogMessage(coloredMessage, coloredLevel, coloredTimestamp, rest)
        }
    })
)

export type LoggerConfiguration = {
    directory: string
    daysToKeepLogs: string
    fileLogLevel: string
    consoleLogLevel: string
}

export function createWinstonLogger(config: LoggerConfiguration) {
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
                winston.format.json()
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

    if (consoleLogLevel && consoleLogLevel !== 'silent') {
        transports.push(
            new winston.transports.Console({
                format: consoleLogFormat,
                level: consoleLogLevel,
                handleExceptions: true,
                handleRejections: true
            })
        )
    }

    const logger = winston.createLogger({ format: winston.format.json(), transports })
    return logger
}
