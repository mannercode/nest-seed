import { MethodLog } from 'common'
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
}

describe('@MethodLog()', () => {
    let service: TestService

    beforeEach(() => {
        service = new TestService()
    })

    it('should log correct data for a synchronous method', () => {
        service.syncMethod('value')

        expect(mockLogger.log).toHaveBeenNthCalledWith(
            1,
            expect.stringContaining('Begin TestService.syncMethod')
        )

        expect(mockLogger.log).toHaveBeenNthCalledWith(
            2,
            expect.stringContaining('End TestService.syncMethod'),
            { args: ['value'], duration: expect.any(Number), return: 'value' }
        )
    })

    it('should log correct data for an asynchronous method', async () => {
        await service.asyncMethod('value')

        expect(mockLogger.log).toHaveBeenNthCalledWith(
            1,
            expect.stringContaining('Begin TestService.asyncMethod')
        )

        expect(mockLogger.log).toHaveBeenNthCalledWith(
            2,
            expect.stringContaining('End TestService.asyncMethod'),
            { args: ['value'], duration: expect.any(Number), return: 'value' }
        )
    })

    it('should log correct data for an observable method', async () => {
        await lastValueFrom(service.observableMethod('value'))

        expect(mockLogger.log).toHaveBeenNthCalledWith(
            1,
            expect.stringContaining('Begin TestService.observableMethod')
        )

        expect(mockLogger.log).toHaveBeenNthCalledWith(
            2,
            expect.stringContaining('End TestService.observableMethod'),
            { args: ['value'], duration: expect.any(Number), return: 'value' }
        )
    })

    it('should log an error with correct data for a synchronous error method', () => {
        expect(() => service.throwSyncError('value')).toThrow('value')

        expect(mockLogger.log).toHaveBeenNthCalledWith(
            1,
            expect.stringContaining('Begin TestService.throwSyncError')
        )

        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining('End TestService.throwSyncError'),
            { args: ['value'], duration: expect.any(Number), error: 'value' }
        )
    })

    it('should log an error with correct data for an asynchronous error method', async () => {
        await expect(service.throwAsyncError('value')).rejects.toThrow()

        expect(mockLogger.log).toHaveBeenNthCalledWith(
            1,
            expect.stringContaining('Begin TestService.throwAsyncError')
        )

        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining('End TestService.throwAsyncError'),
            { args: ['value'], duration: expect.any(Number), error: 'value' }
        )
    })

    it('should log an error with correct data for an observable error method', async () => {
        await expect(lastValueFrom(service.throwObservableError('value'))).rejects.toThrow()

        expect(mockLogger.log).toHaveBeenNthCalledWith(
            1,
            expect.stringContaining('Begin TestService.throwObservableError')
        )

        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining('End TestService.throwObservableError'),
            { args: ['value'], duration: expect.any(Number), error: 'value' }
        )
    })

    it('should log correct data using debug level logging', () => {
        service.debugLog()

        expect(mockLogger.debug).toHaveBeenNthCalledWith(
            1,
            expect.stringContaining('Begin TestService.debugLog')
        )

        expect(mockLogger.debug).toHaveBeenNthCalledWith(
            2,
            expect.stringContaining('End TestService.debugLog'),
            { args: [], duration: expect.any(Number), return: 'value' }
        )
    })

    it('순서에 상관없이 다른 데코레이터와 사용할 수 있어야 한다', () => {

    })
})
