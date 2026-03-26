import { Logger } from '@nestjs/common'
import { BaseService } from '../base.service'

class TestService extends BaseService {
    public callInfo(method: string, data?: object) {
        this.log.info(method, data)
    }
    public callWarn(method: string, data?: object) {
        this.log.warn(method, data)
    }
    public callError(method: string, data?: object) {
        this.log.error(method, data)
    }
}

describe('BaseService', () => {
    let service: TestService

    beforeEach(() => {
        service = new TestService()
    })

    describe('log', () => {
        // 클래스명과 메서드명을 포함한 메시지로 Logger.log를 호출한다
        it('calls Logger.log with class name and method', () => {
            const spy = jest.spyOn(Logger, 'log').mockImplementation()
            const data = { customerId: 'cust-1' }

            service.callInfo('holdTickets', data)

            expect(spy).toHaveBeenCalledWith('TestService.holdTickets', {
                contextType: 'service',
                ...data
            })
            spy.mockRestore()
        })

        // data 없이 호출할 수 있다
        it('calls Logger.log without data', () => {
            const spy = jest.spyOn(Logger, 'log').mockImplementation()

            service.callInfo('holdTickets')

            expect(spy).toHaveBeenCalledWith('TestService.holdTickets', { contextType: 'service' })
            spy.mockRestore()
        })
    })

    describe('warn', () => {
        // 클래스명과 메서드명을 포함한 메시지로 Logger.warn을 호출한다
        it('calls Logger.warn with class name and method', () => {
            const spy = jest.spyOn(Logger, 'warn').mockImplementation()
            const data = { reason: 'rollback' }

            service.callWarn('rollbackPurchase', data)

            expect(spy).toHaveBeenCalledWith('TestService.rollbackPurchase', {
                contextType: 'service',
                ...data
            })
            spy.mockRestore()
        })
    })

    describe('error', () => {
        // 클래스명과 메서드명을 포함한 메시지로 Logger.error를 호출한다
        it('calls Logger.error with class name and method', () => {
            const spy = jest.spyOn(Logger, 'error').mockImplementation()
            const data = { error: 'something failed' }

            service.callError('processPurchase', data)

            expect(spy).toHaveBeenCalledWith('TestService.processPurchase', {
                contextType: 'service',
                ...data
            })
            spy.mockRestore()
        })
    })
})
