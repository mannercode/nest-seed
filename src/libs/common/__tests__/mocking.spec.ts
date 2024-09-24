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
        // This method resets all calls and instances of the mock function.
        // It also deletes any implementations set on the mock function.
        // jest.resetAllMocks()

        // This method only initialises the call count and instance information
        // for all mock functions.
        jest.clearAllMocks()
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
