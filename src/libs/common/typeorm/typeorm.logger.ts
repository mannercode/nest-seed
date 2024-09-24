import { Logger as NestLogger } from '@nestjs/common'
import { Logger as ILogger, QueryRunner } from 'typeorm'

export class TypeormLogger implements ILogger {
    constructor() {}

    logQuery(query: string, parameters?: any[], _queryRunner?: QueryRunner) {
        NestLogger.verbose('QUERY', 'DB', { query, parameters })
    }

    logQueryError(
        error: string | Error,
        query: string,
        parameters?: any[],
        _queryRunner?: QueryRunner
    ) {
        const message = error instanceof Error ? error.message : error

        NestLogger.error(message, 'DB', { query, parameters })
    }

    logQuerySlow(
        runningTime: number,
        query: string,
        parameters?: any[],
        _queryRunner?: QueryRunner
    ) {
        NestLogger.warn('Slow Query', 'DB', { query, parameters, runningTime })
    }

    logSchemaBuild(message: string, _queryRunner?: QueryRunner) {
        NestLogger.log(message, 'DB')
    }

    logMigration(message: string, _queryRunner?: QueryRunner) {
        NestLogger.log(message, 'DB')
    }

    log(level: 'warn' | 'info', message: any, _queryRunner?: QueryRunner) {
        if (level === 'warn') {
            NestLogger.warn(message, 'DB')
        } else if (level === 'info') {
            NestLogger.log(message, 'DB')
        }
    }
}
