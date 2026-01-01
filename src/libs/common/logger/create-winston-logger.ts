/* istanbul ignore file */
import chalk from 'chalk'
import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'
import { Or } from '../validator'
import type { HttpErrorLog, HttpSuccessLog, RpcErrorLog, RpcSuccessLog } from './types'

function colorizeHttpMethod(method: string | undefined) {
    const METHOD = Or(method, 'METHOD').toUpperCase()

    switch (METHOD) {
        case 'GET':
            return chalk.cyan(METHOD)
        case 'POST':
            return chalk.yellow(METHOD)
        case 'PUT':
            return chalk.blue(METHOD)
        case 'PATCH':
            return chalk.blueBright(METHOD)
        case 'DELETE':
            return chalk.red(METHOD)
        default:
            return chalk.magenta(METHOD)
    }
}

function colorizeLogLevel(level: string | undefined) {
    const LEVEL = Or(level, 'LEVEL').toUpperCase()

    switch (LEVEL) {
        case 'ERROR':
            return chalk.red(LEVEL)
        case 'WARN':
            return chalk.yellow(LEVEL)
        case 'INFO':
            return chalk.cyan(LEVEL)
        default:
            return chalk.gray(LEVEL)
    }
}

function formatHttpLogMessage(
    message: string,
    level: string,
    timestamp: string,
    logDetails: HttpErrorLog | HttpSuccessLog
) {
    const statusCode = chalk.magenta(logDetails.statusCode)
    const { request } = logDetails
    const method = colorizeHttpMethod(request.method)
    const url = chalk.green(request.url)
    const nativeBody = Or(request.body, {})
    const body = chalk.blueBright(JSON.stringify(nativeBody, null, 2))

    return `${timestamp} ${level} HTTP ${message} ${statusCode} ${method} ${url} ${body} `
}

function formatRpcLogMessage(
    message: string,
    level: string,
    timestamp: string,
    logDetails: RpcErrorLog | RpcSuccessLog
) {
    const coloredContext = chalk.magenta(JSON.stringify(logDetails.context, null, 2))
    const coloredData = chalk.blueBright(JSON.stringify(logDetails.data, null, 2))

    return `${timestamp} ${level} RPC ${message} ${coloredContext} ${coloredData}`
}

function formatGenericLogMessage(
    message: string,
    level: string,
    timestamp: string,
    logDetails: unknown
) {
    const coloredEtc = chalk.blueBright(JSON.stringify(logDetails, null, 2))

    return `${timestamp} ${level} ${message} ${coloredEtc}`
}

const consoleLogFormat = winston.format.combine(
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.printf((info) => {
        const { message, level, timestamp, ...rest } = info

        const coloredMessage = chalk.white(message)
        const coloredLevel = colorizeLogLevel(level)
        const coloredTimestamp = chalk.gray(timestamp)
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
