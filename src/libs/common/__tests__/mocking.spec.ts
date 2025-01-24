import { HelloClass, getGreeting } from './mocking.fixture'
import { Logger } from '@nestjs/common'

jest.mock('@nestjs/common', () => {
    class Logger {
        static log = jest.fn()
        static error = jest.fn()
        static warn = jest.fn()
        static verbose = jest.fn().mockReturnValue('Mocked verbose')
    }

    return { ...jest.requireActual('@nestjs/common'), Logger }
})

const mockHelloClass = {
    getHello: jest.fn().mockReturnValue('Mocked getHello')
}

jest.mock('./mocking.fixture', () => {
    return {
        HelloClass: jest.fn().mockImplementation(() => mockHelloClass),
        getGreeting: jest.fn()
    }
})

describe('mocking examples', () => {
    afterEach(() => {
        /**
         이 테스트에서 jest.clearAllMocks()을 하지 않으면 에러가 발생한다.
         그러나 jest.config.ts에서 clearMocks: true로 설정하면 jest.clearAllMocks()를 하지 않아도 된다.

         resetAllMocks()와 clearAllMocks()의 차이점

         jest.resetAllMocks()
         This method resets all calls and instances of the mock function.
         It also deletes any implementations set on the mock function.

         jest.clearAllMocks()
         This method only initialises the call count and instance information
         for all mock functions.
         */
    })

    it('Verifies class instantiation and method call', () => {
        const instance = new HelloClass()
        expect(instance.getHello()).toEqual('Mocked getHello')
        expect(HelloClass).toHaveBeenCalledTimes(1)
        expect(mockHelloClass.getHello).toHaveBeenCalledTimes(1)
    })

    it('Ensures proper mocking and calling of an independent function', () => {
        ;(getGreeting as jest.Mock).mockReturnValue('Mocked getGreeting')
        expect(getGreeting()).toEqual('Mocked getGreeting')
        expect(getGreeting).toHaveBeenCalled()
    })

    it('Validates mocking of an external module functionality', () => {
        const value = Logger.verbose('arg1', 'arg2')
        expect(Logger.verbose).toHaveBeenCalledWith('arg1', 'arg2')
        expect(value).toEqual('Mocked verbose')
    })

    it('Verifies that jest.clearAllMocks correctly resets mock call history', () => {
        expect(Logger.verbose).not.toHaveBeenCalledWith('arg1', 'arg2')
    })
})
