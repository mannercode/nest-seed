import { lastValueFrom } from 'rxjs'
import { TestService } from './method-log.fixture'

describe('@MethodLog', () => {
    let service: TestService
    let spyLog: jest.SpyInstance
    let spyError: jest.SpyInstance
    let spyDebug: jest.SpyInstance

    beforeEach(async () => {
        const { TestService } = await import('./method-log.fixture')
        service = new TestService()

        const { Logger } = await import('@nestjs/common')
        spyLog = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {})
        spyError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {})
        spyDebug = jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {})
    })

    describe('logging successes', () => {
        // 동기 메서드인 경우
        describe('when the method is synchronous', () => {
            // 시작과 종료를 로깅한다
            it('logs begin and end', async () => {
                service.syncMethod('value')

                expect(spyLog).toHaveBeenNthCalledWith(
                    1,
                    expect.stringContaining('Begin TestService.syncMethod'),
                    { args: ['value'] }
                )

                expect(spyLog).toHaveBeenNthCalledWith(
                    2,
                    expect.stringContaining('End TestService.syncMethod'),
                    { args: ['value'], duration: expect.any(Number), return: 'value' }
                )
            })
        })

        // 비동기 메서드인 경우
        describe('when the method is async', () => {
            // 시작과 종료를 로깅한다
            it('logs begin and end', async () => {
                await service.asyncMethod('value')

                expect(spyLog).toHaveBeenNthCalledWith(
                    1,
                    expect.stringContaining('Begin TestService.asyncMethod'),
                    { args: ['value'] }
                )

                expect(spyLog).toHaveBeenNthCalledWith(
                    2,
                    expect.stringContaining('End TestService.asyncMethod'),
                    { args: ['value'], duration: expect.any(Number), return: 'value' }
                )
            })
        })

        // Observable 메서드인 경우
        describe('when the method returns an Observable', () => {
            // 시작과 종료를 로깅한다
            it('logs begin and end', async () => {
                await lastValueFrom(service.observableMethod('value'))

                expect(spyLog).toHaveBeenNthCalledWith(
                    1,
                    expect.stringContaining('Begin TestService.observableMethod'),
                    { args: ['value'] }
                )

                expect(spyLog).toHaveBeenNthCalledWith(
                    2,
                    expect.stringContaining('End TestService.observableMethod'),
                    { args: ['value'], duration: expect.any(Number), return: 'value' }
                )
            })
        })
    })

    describe('logging errors', () => {
        // 동기 메서드에서 예외가 발생하는 경우
        describe('when a synchronous method throws', () => {
            // 오류를 로깅한다
            it('logs the error', () => {
                expect(() => service.throwSyncError('value')).toThrow('value')

                expect(spyLog).toHaveBeenNthCalledWith(
                    1,
                    expect.stringContaining('Begin TestService.throwSyncError'),
                    { args: ['value'] }
                )

                expect(spyError).toHaveBeenCalledWith(
                    expect.stringContaining('Error TestService.throwSyncError'),
                    { args: ['value'], duration: expect.any(Number), error: 'value' }
                )
            })
        })

        // 비동기 메서드에서 예외가 발생하는 경우
        describe('when an async method throws', () => {
            // 오류를 로깅한다
            it('logs the error', async () => {
                await expect(service.throwAsyncError('value')).rejects.toThrow()

                expect(spyLog).toHaveBeenNthCalledWith(
                    1,
                    expect.stringContaining('Begin TestService.throwAsyncError'),
                    { args: ['value'] }
                )

                expect(spyError).toHaveBeenCalledWith(
                    expect.stringContaining('Error TestService.throwAsyncError'),
                    { args: ['value'], duration: expect.any(Number), error: 'value' }
                )
            })
        })

        // Observable 메서드에서 예외가 발생하는 경우
        describe('when an Observable method throws', () => {
            // 오류를 로깅한다
            it('logs the error', async () => {
                await expect(lastValueFrom(service.throwObservableError('value'))).rejects.toThrow()

                expect(spyLog).toHaveBeenNthCalledWith(
                    1,
                    expect.stringContaining('Begin TestService.throwObservableError'),
                    { args: ['value'] }
                )

                expect(spyError).toHaveBeenCalledWith(
                    expect.stringContaining('Error TestService.throwObservableError'),
                    { args: ['value'], duration: expect.any(Number), error: 'value' }
                )
            })
        })
    })

    describe('logging options', () => {
        // 로깅 레벨이 debug인 경우
        describe('when the level is debug', () => {
            // debug로 기록한다
            it('logs with the debug level', () => {
                service.debugLog()

                expect(spyDebug).toHaveBeenNthCalledWith(
                    1,
                    expect.stringContaining('Begin TestService.debugLog'),
                    { args: [] }
                )

                expect(spyDebug).toHaveBeenNthCalledWith(
                    2,
                    expect.stringContaining('End TestService.debugLog'),
                    { args: [], duration: expect.any(Number), return: 'value' }
                )
            })
        })

        // excludeArgs가 설정된 경우
        describe('when `excludeArgs` hides the parameters', () => {
            // 제외된 인자를 기록하지 않는다
            it('omits excluded args', () => {
                service.excludeArgs('1', '2')

                expect(spyLog).toHaveBeenNthCalledWith(
                    1,
                    expect.stringContaining('Begin TestService.excludeArgs'),
                    { args: ['1'] }
                )

                expect(spyLog).toHaveBeenNthCalledWith(
                    2,
                    expect.stringContaining('End TestService.excludeArgs'),
                    { args: ['1'], duration: expect.any(Number), return: '1+2' }
                )
            })
        })

        // 중첩 데코레이터가 있는 경우
        describe('when used with other decorators', () => {
            // 정상적으로 로깅한다
            it('still logs correctly', () => {
                service.nestedDecorator()

                expect(spyLog).toHaveBeenNthCalledWith(
                    2,
                    expect.stringContaining('End TestService.nestedDecorator'),
                    { args: [], duration: expect.any(Number), return: 'value' }
                )
            })
        })
    })
})
