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

    it('log()는 winstonLogger.info()로 위임한다', () => {
        const spy = jest.spyOn(winstonLogger, 'info')
        appLoggerService.log(message)
        expect(spy).toHaveBeenCalledWith(message)
    })

    it('error()는 winstonLogger.error()로 위임한다', () => {
        const spy = jest.spyOn(winstonLogger, 'error')
        appLoggerService.error(message)
        expect(spy).toHaveBeenCalledWith(message)
    })

    it('warn()는 winstonLogger.warn()로 위임한다', () => {
        const spy = jest.spyOn(winstonLogger, 'warn')
        appLoggerService.warn(message)
        expect(spy).toHaveBeenCalledWith(message)
    })

    it('debug()는 winstonLogger.debug()로 위임한다', () => {
        const spy = jest.spyOn(winstonLogger, 'debug')
        appLoggerService.debug(message)
        expect(spy).toHaveBeenCalledWith(message)
    })

    it('verbose()는 winstonLogger.verbose()로 위임한다', () => {
        const spy = jest.spyOn(winstonLogger, 'verbose')
        appLoggerService.verbose(message)
        expect(spy).toHaveBeenCalledWith(message)
    })

    it('fatal()은 winstonLogger.error()로 매핑된다', () => {
        const spy = jest.spyOn(winstonLogger, 'error')
        appLoggerService.fatal(message)
        expect(spy).toHaveBeenCalledWith(message)
    })

    it('선택적 파라미터를 winston으로 전달한다', () => {
        const spy = jest.spyOn(winstonLogger, 'info')
        const context = 'OrdersService'
        const meta = { requestId: 'req-123' }

        appLoggerService.log(message, context, meta)

        expect(spy).toHaveBeenCalledWith(message, context, meta)
    })
})
