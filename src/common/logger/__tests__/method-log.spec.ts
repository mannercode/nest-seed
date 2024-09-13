import { MethodLog } from '../method-log'

export const mockLogger = {
    log: jest.fn().mockImplementation(),
    error: jest.fn().mockImplementation(),
    warn: jest.fn().mockImplementation(),
    debug: jest.fn().mockImplementation(),
    verbose: jest.fn().mockImplementation()
}

jest.mock('@nestjs/common', () => {
    return {
        ...jest.requireActual('@nestjs/common'),
        Logger: jest.fn().mockImplementation(() => mockLogger)
    }
})

// Due to initialization issues with jest.mock, I couldn't separate TestRepository into fixture.ts
export class TestService {
    @MethodLog()
    async printLog(_data: string) {
        return 'return value'
    }

    @MethodLog({ level: 'debug' })
    async debugLog() {}

    @MethodLog()
    async throwError(_data: string) {
        throw new Error('error message')
    }

    @MethodLog()
    syncMethod() {}
}

describe('@MethodLog()', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    const service = new TestService()

    it('printLog', async () => {
        await service.printLog('Test User')

        expect(mockLogger.log).toHaveBeenCalledWith('TestService.printLog', {
            args: ['Test User'],
            duration: expect.any(Number),
            return: 'return value'
        })
    })

    it('debugLog', async () => {
        await service.debugLog()

        expect(mockLogger.debug).toHaveBeenCalledWith('TestService.debugLog', {
            args: [],
            duration: expect.any(Number),
            return: undefined
        })
    })

    it('throwError', async () => {
        await expect(service.throwError('data')).rejects.toThrow()
        expect(mockLogger.error).toHaveBeenCalledWith('TestService.throwError', {
            args: ['data'],
            duration: expect.any(Number),
            error: 'error message'
        })
    })

    it('syncMethod', async () => {
        await service.syncMethod()

        expect(mockLogger.log).toHaveBeenCalledWith('TestService.syncMethod', {
            args: [],
            duration: expect.any(Number),
            return: undefined
        })
    })
})
