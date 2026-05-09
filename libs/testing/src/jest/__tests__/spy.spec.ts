import * as Module from './spy.fixture'

// jest.spyOn은 객체의 메서드를 감시하면서 원래 구현을 유지하거나 mock으로 대체한다.
describe('jest.spyOn', () => {
    it('모듈 함수에 spy를 건다', () => {
        const mockFunc = jest.spyOn(Module, 'getGreeting')
        expect(Module.getGreeting()).toEqual('Greeting')
        expect(mockFunc).toHaveBeenCalled()
    })

    it('모듈 함수를 mock으로 대체한다', () => {
        expect(Module.getGreeting()).toEqual('Greeting')

        const mockFunc = jest.spyOn(Module, 'getGreeting').mockReturnValue('Mocked Value')

        expect(Module.getGreeting()).toEqual('Mocked Value')
        expect(mockFunc).toHaveBeenCalled()
    })

    it('클래스 인스턴스 메서드를 mock으로 대체한다', () => {
        const localObj = new Module.HelloClass()
        const mockFunc = jest.spyOn(localObj, 'getHello').mockReturnValue('Mocked Value')

        expect(localObj.getHello()).toEqual('Mocked Value')
        expect(mockFunc).toHaveBeenCalled()
    })

    it('클래스 getter를 mock으로 대체한다', () => {
        const localObj = new Module.HelloClass()
        const mockFunc = jest.spyOn(localObj, 'value', 'get').mockReturnValue(1000)

        expect(localObj.value).toEqual(1000)
        expect(mockFunc).toHaveBeenCalled()
    })

    it('동적으로 import한 인스턴스 메서드에 spy를 건다', async () => {
        const { Logger } = await import('@nestjs/common')

        const spy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {})
        const logger = new Logger()

        logger.log('message', { args: ['value'] })

        expect(spy).toHaveBeenNthCalledWith(1, expect.stringContaining('message'), {
            args: ['value']
        })
    })

    it('동적으로 import한 정적 메서드에 spy를 건다', async () => {
        const { Logger } = await import('@nestjs/common')

        const spy = jest.spyOn(Logger, 'log').mockImplementation(() => {})

        Logger.log('message', { args: ['value'] })

        expect(spy).toHaveBeenNthCalledWith(1, expect.stringContaining('message'), {
            args: ['value']
        })
    })
})
