import type { LoggerService } from '@nestjs/common'
import type winston from 'winston'
import { Injectable } from '@nestjs/common'

@Injectable()
export class AppLoggerService implements LoggerService {
    constructor(private readonly logger: winston.Logger) {}

    debug(message: any, ...optionalParams: any[]) {
        this.logger.debug(message, ...optionalParams)
    }

    error(message: any, ...optionalParams: any[]) {
        this.logger.error(message, ...optionalParams)
    }

    fatal(message: any, ...optionalParams: any[]) {
        this.logger.error(message, ...optionalParams)
    }

    log(message: any, ...optionalParams: any[]) {
        this.logger.info(message, ...optionalParams)
    }

    onModuleDestroy() {
        this.logger.close()
    }

    verbose(message: any, ...optionalParams: any[]) {
        this.logger.verbose(message, ...optionalParams)
    }

    warn(message: any, ...optionalParams: any[]) {
        this.logger.warn(message, ...optionalParams)
    }
}
