import { Logger } from '@nestjs/common'
import { HelloClass, getGreeting } from './mocking.fixture'

jest.mock('@nestjs/common', () => {
    class Logger {
        static log = jest.fn()
        static error = jest.fn()
        static warn = jest.fn()
        static verbose = jest.fn()
    }

    return { ...jest.requireActual('@nestjs/common'), Logger }
})

jest.mock('./mocking.fixture', () => {
    return {
        HelloClass: jest.fn(),
        getGreeting: jest.fn()
    }
})

/**
 * jest.mock
 *   Automatically mocks the entire module, removing dependencies and allowing focus on the code under test.
 *   모듈 전체를 대상으로 자동 목(mock) 처리하여 의존성 제거 및 테스트 대상 코드에 집중할 수 있게 해줍니다.
 */
describe('jest.mock examples', () => {
    test('Module mocking', () => {
        ;(Logger.verbose as jest.Mock).mockReturnValue('Mocked verbose')
        const value = Logger.verbose('arg1', 'arg2')

        expect(Logger.verbose).toHaveBeenCalledWith('arg1', 'arg2')
        expect(value).toEqual('Mocked verbose')
    })

    test('Class mocking', () => {
        ;(HelloClass as jest.Mock).mockImplementation(() => ({
            getHello: jest.fn().mockReturnValue('Mocked getHello')
        }))

        const instance = new HelloClass()

        expect(instance.getHello()).toEqual('Mocked getHello')
        expect(instance.getHello).toHaveBeenCalledTimes(1)
    })

    test('Function mocking', () => {
        ;(getGreeting as jest.Mock).mockReturnValue('Mocked getGreeting')

        expect(getGreeting()).toEqual('Mocked getGreeting')
        expect(getGreeting).toHaveBeenCalled()
    })
})
