import * as Module from './spy.fixture'

// 정적 import 대상은 모듈 로드 시점에 바인딩되어 어느 시점에든 spyOn을 걸 수 있다.
// 동적 import 대상은 import가 끝난 뒤에야 spyOn을 걸 수 있으므로, 그 순서를 별도 it로 보여준다.
describe('jest.spyOn', () => {
    it('모듈 함수에 감시자를 건다', () => {
        const mockFunc = jest.spyOn(Module, 'getGreeting')
        expect(Module.getGreeting()).toEqual('Greeting')
        expect(mockFunc).toHaveBeenCalled()
    })

    it('모듈 함수를 mock 구현으로 대체한다', () => {
        expect(Module.getGreeting()).toEqual('Greeting')

        const mockFunc = jest.spyOn(Module, 'getGreeting').mockReturnValue('Mocked Value')

        expect(Module.getGreeting()).toEqual('Mocked Value')
        expect(mockFunc).toHaveBeenCalled()
    })

    it('클래스 인스턴스 메서드를 mock 구현으로 대체한다', () => {
        const localObj = new Module.HelloClass()
        const mockFunc = jest.spyOn(localObj, 'getHello').mockReturnValue('Mocked Value')

        expect(localObj.getHello()).toEqual('Mocked Value')
        expect(mockFunc).toHaveBeenCalled()
    })

    it('클래스 getter를 mock 구현으로 대체한다', () => {
        const localObj = new Module.HelloClass()
        const mockFunc = jest.spyOn(localObj, 'value', 'get').mockReturnValue(1000)

        expect(localObj.value).toEqual(1000)
        expect(mockFunc).toHaveBeenCalled()
    })

    it('동적으로 가져온 인스턴스 메서드에 감시자를 건다', async () => {
        const { Logger } = await import('@nestjs/common')

        const spy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {})
        const logger = new Logger()

        logger.log('message', { args: ['value'] })

        expect(spy).toHaveBeenNthCalledWith(1, expect.stringContaining('message'), {
            args: ['value']
        })
    })

    it('동적으로 가져온 정적 메서드에 감시자를 건다', async () => {
        const { Logger } = await import('@nestjs/common')

        const spy = jest.spyOn(Logger, 'log').mockImplementation(() => {})

        Logger.log('message', { args: ['value'] })

        expect(spy).toHaveBeenNthCalledWith(1, expect.stringContaining('message'), {
            args: ['value']
        })
    })
})
