import { Logger } from '@nestjs/common'
import { TypeormLogger } from 'common'

jest.mock('@nestjs/common', () => {
    class Logger {
        static log = jest.fn()
        static error = jest.fn()
        static warn = jest.fn()
        static verbose = jest.fn().mockReturnValue('Mocked verbose')
    }

    return { ...jest.requireActual('@nestjs/common'), Logger }
})

describe('TypeormLogger', () => {
    let logger: TypeormLogger

    beforeEach(() => {
        logger = new TypeormLogger()
    })

    it('logQuery', () => {
        const query = 'SELECT * FROM users'
        const parameters = ['param1', 'param2']

        logger.logQuery(query, parameters)

        expect(Logger.verbose).toHaveBeenCalledWith('QUERY', 'DB', { query, parameters })
    })

    it('logQueryError', () => {
        const message = 'Query Error'
        const query = 'SELECT * FROM users'
        const parameters = ['param1', 'param2']
        const error = new Error(message)

        logger.logQueryError(error, query, parameters)
        expect(Logger.error).toHaveBeenCalledWith(error.message, 'DB', { query, parameters })

        logger.logQueryError(message, query, parameters)
        expect(Logger.error).toHaveBeenCalledWith(message, 'DB', { query, parameters })
    })

    it('logQuerySlow', () => {
        const runningTime = 2000 // ms
        const query = 'SELECT * FROM users'
        const parameters = ['param1', 'param2']

        logger.logQuerySlow(runningTime, query, parameters)

        expect(Logger.warn).toHaveBeenCalledWith('Slow Query', 'DB', {
            query,
            parameters,
            runningTime
        })
    })

    it('logSchemaBuild', () => {
        const message = 'Schema build log message'

        logger.logSchemaBuild(message)

        expect(Logger.log).toHaveBeenCalledWith(message, 'DB')
    })

    it('logMigration', () => {
        const message = 'Migration log message'

        logger.logMigration(message)

        expect(Logger.log).toHaveBeenCalledWith(message, 'DB')
    })

    it('log', () => {
        logger.log('warn', 'warn message')
        logger.log('info', 'info message')

        expect(Logger.warn).toHaveBeenCalledWith('warn message', 'DB')
        expect(Logger.log).toHaveBeenCalledWith('info message', 'DB')
    })
})
