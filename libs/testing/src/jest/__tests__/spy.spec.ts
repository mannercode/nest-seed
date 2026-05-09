import * as Module from './spy.fixture'

/**
 * jest.spyOn
 *   객체의 특정 메서드를 감시(Spy)하고, 원래의 구현을 유지하거나 필요시 mock 으로 대체할 수
 *   있어, 함수 호출과 동작을 세밀하게 제어할 수 있다.
 */
describe('jest.spyOn', () => {
    it('모듈 함수에 spy를 건다', () => {
        const mockFunc = jest.spyOn(Module, 'getGreeting')
        expect(Module.getGreeting()).toEqual('Greeting')
        expect(mockFunc).toHaveBeenCalled()
    })

    it('모듈 함수를 목킹한다', () => {
        expect(Module.getGreeting()).toEqual('Greeting')

        const mockFunc = jest.spyOn(Module, 'getGreeting').mockReturnValue('Mocked Value')

        expect(Module.getGreeting()).toEqual('Mocked Value')
        expect(mockFunc).toHaveBeenCalled()
    })

    it('클래스 인스턴스 메서드를 목킹한다', () => {
        const localObj = new Module.HelloClass()
        const mockFunc = jest.spyOn(localObj, 'getHello').mockReturnValue('Mocked Value')

        expect(localObj.getHello()).toEqual('Mocked Value')
        expect(mockFunc).toHaveBeenCalled()
    })

    it('클래스 getter를 목킹한다', () => {
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
