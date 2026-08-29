import type { Mock } from 'vitest'
import { Logger } from '@nestjs/common'
import { getGreeting, HelloClass } from './mocking.fixture.js'

vi.mock('@nestjs/common', async (importOriginal) => {
    class MockLogger {
        static error = vi.fn()
        static log = vi.fn()
        static verbose = vi.fn()
        static warn = vi.fn()
    }

    return { ...(await importOriginal<Record<string, unknown>>()), Logger: MockLogger }
})

vi.mock('./mocking.fixture.js', () => ({ getGreeting: vi.fn(), HelloClass: vi.fn() }))

describe('vi.mock', () => {
    it('모듈을 mock 구현으로 대체한다', () => {
        ;(Logger.verbose as unknown as Mock).mockImplementation(() => undefined)

        Logger.verbose('arg1', 'arg2')

        expect(Logger.verbose).toHaveBeenCalledWith('arg1', 'arg2')
    })

    it('클래스를 mock 구현으로 대체한다', () => {
        ;(HelloClass as Mock).mockImplementation(function () {
            return { getHello: vi.fn().mockReturnValue('Mocked getHello') }
        })

        const instance = new HelloClass()

        expect(instance.getHello()).toEqual('Mocked getHello')
        expect(instance.getHello).toHaveBeenCalledTimes(1)
    })

    it('함수를 mock 구현으로 대체한다', () => {
        ;(getGreeting as Mock).mockReturnValue('Mocked getGreeting')

        expect(getGreeting()).toEqual('Mocked getGreeting')
        expect(getGreeting).toHaveBeenCalled()
    })
})
