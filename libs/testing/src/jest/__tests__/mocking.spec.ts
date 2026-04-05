import { Logger } from '@nestjs/common'
import { getGreeting, HelloClass } from './mocking.fixture'

jest.mock('@nestjs/common', () => {
    class MockLogger {
        static error = jest.fn()
        static log = jest.fn()
        static verbose = jest.fn()
        static warn = jest.fn()
    }

    return { ...jest.requireActual('@nestjs/common'), Logger: MockLogger }
})

jest.mock('./mocking.fixture', () => ({ getGreeting: jest.fn(), HelloClass: jest.fn() }))

describe('jest.mock examples', () => {
    // 모듈을 목킹한다
    it('mocks a module', () => {
        ;(Logger.verbose as unknown as jest.Mock).mockImplementation(() => undefined)

        Logger.verbose('arg1', 'arg2')

        expect(Logger.verbose).toHaveBeenCalledWith('arg1', 'arg2')
    })

    // 클래스를 목킹한다
    it('mocks a class', () => {
        ;(HelloClass as jest.Mock).mockImplementation(() => ({
            getHello: jest.fn().mockReturnValue('Mocked getHello')
        }))

        const instance = new HelloClass()

        expect(instance.getHello()).toEqual('Mocked getHello')
        expect(instance.getHello).toHaveBeenCalledTimes(1)
    })

    // 함수를 목킹한다
    it('mocks a function', () => {
        ;(getGreeting as jest.Mock).mockReturnValue('Mocked getGreeting')

        expect(getGreeting()).toEqual('Mocked getGreeting')
        expect(getGreeting).toHaveBeenCalled()
    })
})
