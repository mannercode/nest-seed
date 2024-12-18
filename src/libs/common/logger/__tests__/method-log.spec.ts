import { MethodLog, MethodLogOnEvent } from 'common'
import { lastValueFrom, Observable, of, throwError } from 'rxjs'

export const mockLogger = {
    log: jest.fn().mockImplementation(),
    error: jest.fn().mockImplementation(),
    warn: jest.fn().mockImplementation(),
    debug: jest.fn().mockImplementation(),
    verbose: jest.fn().mockImplementation()
}

jest.mock('@nestjs/common', () => ({
    ...jest.requireActual('@nestjs/common'),
    Logger: jest.fn().mockImplementation(() => mockLogger)
}))

// Due to initialization issues with jest.mock, I couldn't separate TestRepository into fixture.ts
export class TestService {
    @MethodLog()
    syncMethod(data: string) {
        return data
    }

    @MethodLog()
    async asyncMethod(data: string) {
        return data
    }

    @MethodLog()
    observableMethod(data: string): Observable<string> {
        return of(data)
    }

    @MethodLog()
    throwSyncError(data: string) {
        throw new Error(data)
    }

    @MethodLog()
    async throwAsyncError(data: string) {
        throw new Error(data)
    }

    @MethodLog()
    throwObservableError(data: string) {
        return throwError(() => new Error(data))
    }

    @MethodLog({ level: 'debug' })
    debugLog() {
        return 'value'
    }

    @MethodLogOnEvent('eventName')
    methodLogOnEvent(data: string) {
        return data
    }
}

describe('@MethodLog()', () => {
    let service: TestService

    beforeEach(() => {
        jest.clearAllMocks()
        service = new TestService()
    })

    it('syncMethod', () => {
        service.syncMethod('value')

        expect(mockLogger.log).toHaveBeenCalledWith('TestService.syncMethod', {
            args: ['value'],
            duration: expect.any(Number),
            return: 'value'
        })
    })

    it('asyncMethod', async () => {
        await service.asyncMethod('value')

        expect(mockLogger.log).toHaveBeenCalledWith('TestService.asyncMethod', {
            args: ['value'],
            duration: expect.any(Number),
            return: 'value'
        })
    })

    it('observableMethod', async () => {
        await lastValueFrom(service.observableMethod('value'))

        expect(mockLogger.log).toHaveBeenCalledWith('TestService.observableMethod', {
            args: ['value'],
            duration: expect.any(Number),
            return: 'value'
        })
    })

    it('throwSyncError', () => {
        const callback = () => service.throwSyncError('value')
        expect(callback).toThrow('value')

        expect(mockLogger.error).toHaveBeenCalledWith('TestService.throwSyncError', {
            args: ['value'],
            duration: expect.any(Number),
            error: 'value'
        })
    })

    it('throwAsyncError', async () => {
        await expect(service.throwAsyncError('value')).rejects.toThrow()

        expect(mockLogger.error).toHaveBeenCalledWith('TestService.throwAsyncError', {
            args: ['value'],
            duration: expect.any(Number),
            error: 'value'
        })
    })

    it('throwObservableError', async () => {
        await expect(lastValueFrom(service.throwObservableError('value'))).rejects.toThrow()

        expect(mockLogger.error).toHaveBeenCalledWith('TestService.throwObservableError', {
            args: ['value'],
            duration: expect.any(Number),
            error: 'value'
        })
    })

    it('debugLog', () => {
        service.debugLog()

        expect(mockLogger.debug).toHaveBeenCalledWith('TestService.debugLog', {
            args: [],
            duration: expect.any(Number),
            return: 'value'
        })
    })

    it('methodLogOnEvent', async () => {
        await service.methodLogOnEvent('value')

        expect(mockLogger.log).toHaveBeenCalledWith('TestService.methodLogOnEvent', {
            args: ['value'],
            duration: expect.any(Number),
            return: 'value'
        })
    })
})
