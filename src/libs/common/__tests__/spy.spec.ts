import * as Module from './spy.fixture'

// jest.spyOn
// 객체의 특정 메서드를 감시(Spy)하고, 원래의 구현을 유지하거나 필요시 목(mock)으로 대체할 수 있어,
// 함수 호출과 동작을 세밀하게 제어할 수 있습니다.
describe('spy examples', () => {
    it('Function spy', () => {
        const mockFunc = jest.spyOn(Module, 'getGreeting')
        expect(Module.getGreeting()).toEqual('Greeting')
        expect(mockFunc).toHaveBeenCalled()
    })

    it('Function mocking', () => {
        expect(Module.getGreeting()).toEqual('Greeting')

        const mockFunc = jest.spyOn(Module, 'getGreeting').mockReturnValue('Mocked Value')

        expect(Module.getGreeting()).toEqual('Mocked Value')
        expect(mockFunc).toHaveBeenCalled()
    })

    it('Class instance mocking', () => {
        const localObj = new Module.HelloClass()
        const mockFunc = jest.spyOn(localObj, 'getHello').mockReturnValue('Mocked Value')

        expect(localObj.getHello()).toEqual('Mocked Value')
        expect(mockFunc).toHaveBeenCalled()
    })
})
