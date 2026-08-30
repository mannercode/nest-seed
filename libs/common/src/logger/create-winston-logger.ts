import { ecsFormat } from '@elastic/ecs-winston-format'
import winston from 'winston'

export type LoggerConfig = {
    consoleLogLevel: string
    environment: string
    serviceName: string
    serviceNodeName: string
}

export function createWinstonLogger(config: LoggerConfig) {
    const { consoleLogLevel, environment, serviceName, serviceNodeName } = config

    const transports: winston.transport[] = []

    if (consoleLogLevel !== 'silent') {
        transports.push(
            new winston.transports.Console({
                format: ecsFormat({
                    apmIntegration: false,
                    serviceEnvironment: environment,
                    serviceName,
                    serviceNodeName
                }),
                handleExceptions: true,
                handleRejections: true,
                level: consoleLogLevel
            })
        )
    }

    return winston.createLogger({ silent: consoleLogLevel === 'silent', transports })
}
