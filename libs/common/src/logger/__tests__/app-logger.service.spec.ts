import winston from 'winston'
import { AppLoggerService } from '../app-logger.service'

describe('AppLoggerService', () => {
    let appLoggerService: AppLoggerService
    let winstonLogger: winston.Logger
    const message = 'test message'

    beforeEach(() => {
        winstonLogger = winston.createLogger({
            format: winston.format.simple(),
            level: '',
            silent: true,
            transports: [new winston.transports.Console()]
        })
        appLoggerService = new AppLoggerService(winstonLogger)
    })

    afterEach(() => {
        appLoggerService.onModuleDestroy()
    })

    it('logs at info level', () => {
        const spy = jest.spyOn(winstonLogger, 'info')
        appLoggerService.log(message)

        expect(spy).toHaveBeenCalledWith(message)
    })

    it('logs at error level', () => {
        const spy = jest.spyOn(winstonLogger, 'error')
        appLoggerService.error(message)

        expect(spy).toHaveBeenCalledWith(message)
    })

    it('logs at warn level', () => {
        const spy = jest.spyOn(winstonLogger, 'warn')
        appLoggerService.warn(message)

        expect(spy).toHaveBeenCalledWith(message)
    })

    it('logs at debug level', () => {
        const spy = jest.spyOn(winstonLogger, 'debug')
        appLoggerService.debug(message)

        expect(spy).toHaveBeenCalledWith(message)
    })

    it('logs at verbose level', () => {
        const spy = jest.spyOn(winstonLogger, 'verbose')
        appLoggerService.verbose(message)

        expect(spy).toHaveBeenCalledWith(message)
    })

    it('logs at fatal level', () => {
        const spy = jest.spyOn(winstonLogger, 'error')
        appLoggerService.fatal(message)

        expect(spy).toHaveBeenCalledWith(message)
    })

    // 선택적 파라미터를 winston으로 전달한다
    it('passes optional params through to winston', () => {
        const spy = jest.spyOn(winstonLogger, 'info')
        const context = 'OrdersService'
        const meta = { requestId: 'req-123' }

        appLoggerService.log(message, context, meta)

        expect(spy).toHaveBeenCalledWith(message, context, meta)
    })
})
