import { lastValueFrom } from 'rxjs'
import { TestService } from './method-log.fixture'

const mockLogger = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn()
}

jest.mock('@nestjs/common', () => ({
    ...jest.requireActual('@nestjs/common'),
    Logger: jest.fn().mockImplementation(() => mockLogger)
}))

describe('@MethodLog()', () => {
    let service: TestService

    beforeEach(async () => {
        const { TestService } = await import('./method-log.fixture')
        service = new TestService()
    })

    it('동기 메서드의 시작과 종료를 로깅해야 한다', () => {
        service.syncMethod('value')

        expect(mockLogger.log).toHaveBeenNthCalledWith(
            1,
            expect.stringContaining('Begin TestService.syncMethod'),
            { args: ['value'] }
        )

        expect(mockLogger.log).toHaveBeenNthCalledWith(
            2,
            expect.stringContaining('End TestService.syncMethod'),
            { args: ['value'], duration: expect.any(Number), return: 'value' }
        )
    })

    it('비동기 메서드의 시작과 완료를 로깅해야 한다', async () => {
        await service.asyncMethod('value')

        expect(mockLogger.log).toHaveBeenNthCalledWith(
            1,
            expect.stringContaining('Begin TestService.asyncMethod'),
            { args: ['value'] }
        )

        expect(mockLogger.log).toHaveBeenNthCalledWith(
            2,
            expect.stringContaining('End TestService.asyncMethod'),
            { args: ['value'], duration: expect.any(Number), return: 'value' }
        )
    })

    it('Observable 메서드의 시작과 완료를 로깅해야 한다', async () => {
        await lastValueFrom(service.observableMethod('value'))

        expect(mockLogger.log).toHaveBeenNthCalledWith(
            1,
            expect.stringContaining('Begin TestService.observableMethod'),
            { args: ['value'] }
        )

        expect(mockLogger.log).toHaveBeenNthCalledWith(
            2,
            expect.stringContaining('End TestService.observableMethod'),
            { args: ['value'], duration: expect.any(Number), return: 'value' }
        )
    })

    it('동기 메서드 실행 중 발생한 오류를 로깅해야 한다', () => {
        expect(() => service.throwSyncError('value')).toThrow('value')

        expect(mockLogger.log).toHaveBeenNthCalledWith(
            1,
            expect.stringContaining('Begin TestService.throwSyncError'),
            { args: ['value'] }
        )

        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining('Error TestService.throwSyncError'),
            { args: ['value'], duration: expect.any(Number), error: 'value' }
        )
    })

    it('비동기 메서드 실행 중 발생한 오류를 로깅해야 한다', async () => {
        await expect(service.throwAsyncError('value')).rejects.toThrow()

        expect(mockLogger.log).toHaveBeenNthCalledWith(
            1,
            expect.stringContaining('Begin TestService.throwAsyncError'),
            { args: ['value'] }
        )

        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining('Error TestService.throwAsyncError'),
            { args: ['value'], duration: expect.any(Number), error: 'value' }
        )
    })

    it('Observable 메서드 실행 중 발생한 오류를 로깅해야 한다', async () => {
        await expect(lastValueFrom(service.throwObservableError('value'))).rejects.toThrow()

        expect(mockLogger.log).toHaveBeenNthCalledWith(
            1,
            expect.stringContaining('Begin TestService.throwObservableError'),
            { args: ['value'] }
        )

        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining('Error TestService.throwObservableError'),
            { args: ['value'], duration: expect.any(Number), error: 'value' }
        )
    })

    it('지정된 로깅 레벨로 메서드를 기록해야 한다', () => {
        service.debugLog()

        expect(mockLogger.debug).toHaveBeenNthCalledWith(
            1,
            expect.stringContaining('Begin TestService.debugLog'),
            { args: [] }
        )

        expect(mockLogger.debug).toHaveBeenNthCalledWith(
            2,
            expect.stringContaining('End TestService.debugLog'),
            { args: [], duration: expect.any(Number), return: 'value' }
        )
    })

    it('다른 데코레이터와 함께 사용해도 정상적으로 로깅되어야 한다', () => {
        service.nestedDecorator()

        expect(mockLogger.log).toHaveBeenNthCalledWith(
            2,
            expect.stringContaining('End TestService.nestedDecorator'),
            { args: [], duration: expect.any(Number), return: 'value' }
        )
    })
})
