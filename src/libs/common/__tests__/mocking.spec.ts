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

const resetedMock = jest.fn().mockReturnValue('value')

// jest.mock
// 모듈 전체를 대상으로 자동 목(mock) 처리하여 의존성 제거 및 테스트 대상 코드에 집중할 수 있게 해줍니다.
describe('jest.mock examples', () => {
    it('Module mocking', () => {
        ;(Logger.verbose as jest.Mock).mockReturnValue('Mocked verbose')
        const value = Logger.verbose('arg1', 'arg2')

        expect(Logger.verbose).toHaveBeenCalledWith('arg1', 'arg2')
        expect(value).toEqual('Mocked verbose')
    })

    it('Class mocking', () => {
        ;(HelloClass as jest.Mock).mockImplementation(() => ({
            getHello: jest.fn().mockReturnValue('Mocked getHello')
        }))

        const instance = new HelloClass()

        expect(instance.getHello()).toEqual('Mocked getHello')
        expect(instance.getHello).toHaveBeenCalledTimes(1)
    })

    it('Function mocking', () => {
        ;(getGreeting as jest.Mock).mockReturnValue('Mocked getGreeting')

        expect(getGreeting()).toEqual('Mocked getGreeting')
        expect(getGreeting).toHaveBeenCalled()
    })

    it('clearMocks가 모킹 호출 기록을 올바르게 초기화하는지 확인한다', () => {
        expect(Logger.verbose).not.toHaveBeenCalledWith('arg1', 'arg2')
    })

    it('resetMocks가 모킹을 초기화 하는지 검증', () => {
        expect(resetedMock()).not.toEqual('value')
    })
})
