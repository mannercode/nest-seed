import { Injectable, LoggerService } from '@nestjs/common'
import * as winston from 'winston'

@Injectable()
export class AppLoggerService implements LoggerService {
    constructor(private logger: winston.Logger) {}

    log(message: any, ...optionalParams: any[]) {
        this.logger.info(message, optionalParams)
    }

    error(message: any, ...optionalParams: any[]) {
        this.logger.error(message, optionalParams)
    }

    warn(message: any, ...optionalParams: any[]) {
        this.logger.warn(message, optionalParams)
    }

    debug(message: any, ...optionalParams: any[]) {
        this.logger.debug(message, optionalParams)
    }

    verbose(message: any, ...optionalParams: any[]) {
        this.logger.verbose(message, optionalParams)
    }
}
