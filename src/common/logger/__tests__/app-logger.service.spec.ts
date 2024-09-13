import * as winston from 'winston'
import { AppLoggerService } from '..'

describe('AppLoggerService', () => {
    let appLoggerService: AppLoggerService
    let winstonLogger: winston.Logger
    const message = 'test message'

    beforeEach(() => {
        winstonLogger = winston.createLogger({
            silent: true,
            level: '',
            format: winston.format.simple(),
            transports: [new winston.transports.Console()]
        })
        appLoggerService = new AppLoggerService(winstonLogger)
    })

    afterEach(() => {
        winstonLogger.close()
        jest.restoreAllMocks()
    })

    it('info', () => {
        const spy = jest.spyOn(winstonLogger, 'info')
        appLoggerService.log(message)

        expect(spy).toHaveBeenCalledWith(message, [])
    })

    it('error', () => {
        const spy = jest.spyOn(winstonLogger, 'error')
        appLoggerService.error(message)

        expect(spy).toHaveBeenCalledWith(message, [])
    })

    it('warn', () => {
        const spy = jest.spyOn(winstonLogger, 'warn')
        appLoggerService.warn(message)

        expect(spy).toHaveBeenCalledWith(message, [])
    })

    it('debug', () => {
        const spy = jest.spyOn(winstonLogger, 'debug')
        appLoggerService.debug(message)

        expect(spy).toHaveBeenCalledWith(message, [])
    })

    it('verbose', () => {
        const spy = jest.spyOn(winstonLogger, 'verbose')
        appLoggerService.verbose(message)

        expect(spy).toHaveBeenCalledWith(message, [])
    })
})
