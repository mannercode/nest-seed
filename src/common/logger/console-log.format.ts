/* istanbul ignore file */

import * as winston from 'winston'
import * as chalk from 'chalk'

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
    runningTime: string
}

const formatHttpLog = (
    formattedMessage: string,
    formattedLevel: string,
    formattedTimestamp: string,
    etc: HttpLogInfo
) => {
    const httpMethod = colorHttpMethod(etc.method)
    const httpStatus = chalk.magenta(etc.statusCode)
    const url = chalk.green(etc.url)
    const requestBody = etc.body ? chalk.blueBright(JSON.stringify(etc.body)) : ''
    const runningTime = chalk.magenta(etc.runningTime ?? '')

    return `${formattedTimestamp} ${formattedLevel} HTTP ${httpStatus} ${httpMethod} ${url} ${requestBody} ${formattedMessage}  ${runningTime}`
}

interface DatabaseLogInfo {
    query: string
    parameters: string
    runningTime: string
}

const formatDatabaseLog = (
    formattedMessage: string,
    formattedLevel: string,
    formattedTimestamp: string,
    etc: DatabaseLogInfo
) => {
    const query = chalk.green(etc.query ?? '')
    const parameters = chalk.blueBright(etc.parameters ?? '')
    const runningTime = chalk.magenta(etc.runningTime ?? '')

    return `${formattedTimestamp} ${formattedLevel} TYPEORM ${formattedMessage} ${query} ${parameters} ${runningTime}`
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

export const consoleLogFormat = winston.format.combine(
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.printf((info) => {
        const { message, level, timestamp, ...etc } = info

        const formattedMessage = chalk.white(message)
        const formattedLevel = colorLevels(level)
        const formattedTimestamp = chalk.gray(timestamp)

        if (etc[0] === 'HTTP') {
            return formatHttpLog(formattedMessage, formattedLevel, formattedTimestamp, etc[1] ?? {})
        } else if (etc[0] === 'DB') {
            return formatDatabaseLog(
                formattedMessage,
                formattedLevel,
                formattedTimestamp,
                etc[1] ?? {}
            )
        } else {
            return formatGenericLog(formattedMessage, formattedLevel, formattedTimestamp, etc ?? {})
        }
    })
)
