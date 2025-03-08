import chalk from 'chalk'
import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'

/* istanbul ignore next */
const colorHttpMethod = (method: string) => {
    const METHOD = (method ?? 'METHOD').toUpperCase()

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

/* istanbul ignore next */
const colorLevels = (level: string) => {
    const LEVEL = (level ?? 'LEVEL').toUpperCase()

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

interface HttpLogInfo {
    method: string
    statusCode: string
    url: string
    body: unknown
    duration: string
}

/* istanbul ignore next */
const formatHttpLog = (
    formattedMessage: string,
    formattedLevel: string,
    formattedTimestamp: string,
    etc: HttpLogInfo
) => {
    const httpMethod = colorHttpMethod(etc.method)
    const httpStatus = chalk.magenta(etc.statusCode)
    const url = chalk.green(etc.url)
    const requestBody = chalk.blueBright(JSON.stringify(etc.body ?? {}))
    const duration = chalk.magenta(etc.duration ?? '')

    return `${formattedTimestamp} ${formattedLevel} HTTP ${httpStatus} ${httpMethod} ${url} ${requestBody} ${formattedMessage}  ${duration}`
}

const formatGenericLog = (
    formattedMessage: string,
    formattedLevel: string,
    formattedTimestamp: string,
    etc: unknown
) => {
    const formattedEtc = chalk.green(JSON.stringify(etc))

    return `${formattedTimestamp} ${formattedLevel} ${formattedMessage} ${formattedEtc}`
}

const consoleLogFormat = winston.format.combine(
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.printf((info) => {
        const { message, level, timestamp, ...rest } = info

        const formattedMessage = chalk.white(message)
        const formattedLevel = colorLevels(level)
        const formattedTimestamp = chalk.gray(timestamp)

        if (rest[0] === 'HTTP') {
            return formatHttpLog(
                formattedMessage,
                formattedLevel,
                formattedTimestamp,
                rest[1] as any
            )
        } else {
            return formatGenericLog(formattedMessage, formattedLevel, formattedTimestamp, rest)
        }
    })
)

export interface LoggerConfiguration {
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
