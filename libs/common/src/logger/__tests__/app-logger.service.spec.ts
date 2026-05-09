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

    it.each([
        ['log', 'info'],
        ['error', 'error'],
        ['warn', 'warn'],
        ['debug', 'debug'],
        ['verbose', 'verbose'],
        // fatal 은 winston 에 동급 레벨이 없어 error 로 매핑된다
        ['fatal', 'error']
    ] as const)('%s() 는 winstonLogger.%s() 로 위임한다', (serviceMethod, winstonMethod) => {
        const spy = jest.spyOn(winstonLogger, winstonMethod)
        appLoggerService[serviceMethod](message)

        expect(spy).toHaveBeenCalledTimes(1)
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
