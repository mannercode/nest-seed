/* istanbul ignore file */

/**
 * This file is ignored in the test coverage because testing it is challenging and seeing logs during testing can be distracting.
 */

import { Exception, Path } from 'common'
import * as winston from 'winston'
import * as DailyRotateFile from 'winston-daily-rotate-file'
import { consoleLogFormat } from './console-log.format'

export interface LoggerConfiguration {
    directory: string
    daysToKeepLogs: string
    fileLogLevel: string
    consoleLogLevel: string
}

export async function initializeLogger(config: LoggerConfiguration) {
    const { directory, daysToKeepLogs, fileLogLevel, consoleLogLevel } = config

    if (!(await Path.isWritable(directory))) {
        throw new Exception(`"${directory}" is not writable.`)
    }

    const transports: any[] = []

    const logFileOptions = {
        dirname: directory,
        zippedArchive: false,
        maxSize: '10m',
        createSymlink: true,
        format: winston.format.combine(
            winston.format.timestamp({ format: 'HH:mm:ss.SSS' }),
            winston.format.prettyPrint()
        )
    }

    if (fileLogLevel && fileLogLevel !== 'null') {
        transports.push(
            new DailyRotateFile({
                ...logFileOptions,
                datePattern: 'YYYY-MM-DD',
                maxFiles: daysToKeepLogs,
                symlinkName: `current.log`,
                filename: `%DATE%.log`,
                level: fileLogLevel
            })
        )

        transports.push(
            new DailyRotateFile({
                ...logFileOptions,
                datePattern: 'YYYY-MM-DD',
                maxFiles: daysToKeepLogs,
                symlinkName: `errors.log`,
                filename: `err-%DATE%.log`,
                level: 'error'
            })
        )
    }

    if (consoleLogLevel && consoleLogLevel !== 'null') {
        transports.push(
            new winston.transports.Console({
                format: consoleLogFormat,
                level: consoleLogLevel
            })
        )
    }

    const exceptionHandlers = new DailyRotateFile({
        ...logFileOptions,
        datePattern: 'YYYY-MM-DD',
        maxFiles: daysToKeepLogs,
        symlinkName: `exceptions.log`,
        filename: `exception-%DATE%.log`,
        level: 'error'
    })

    const logger = winston.createLogger({
        format: winston.format.json(),
        transports,
        exceptionHandlers
    })

    return logger
}
