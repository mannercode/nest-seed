import { HelloClass, getGreeting } from './mocking.fixture'
import { Logger } from '@nestjs/common'

jest.mock('@nestjs/common', () => {
    class Logger {
        static log = jest.fn()
        static error = jest.fn()
        static warn = jest.fn()
        static verbose = jest.fn()
    }

    return { ...jest.requireActual('@nestjs/common'), Logger }
})

const mockHelloClass = { getHello: jest.fn() }

jest.mock('./mocking.fixture', () => {
    return {
        HelloClass: jest.fn(),
        getGreeting: jest.fn()
    }
})

describe('mocking examples', () => {
    beforeEach(() => {
        // resetMocks: true로 인해 mock 함수가 초기화되므로, 각 테스트 전에 반환 값을 재설정
        mockHelloClass.getHello.mockReturnValue('Mocked getHello')
        ;(HelloClass as jest.Mock).mockImplementation(() => mockHelloClass)
        ;(Logger.verbose as jest.Mock).mockReturnValue('Mocked verbose')
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
