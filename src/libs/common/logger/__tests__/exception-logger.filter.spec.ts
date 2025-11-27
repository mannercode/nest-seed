import { withTestId } from 'testlib'
import type { Fixture } from './exception-logger.filter.fixture'

describe('ExceptionLoggerFilter', () => {
    let fixture: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./exception-logger.filter.fixture')
        fixture = await createFixture()
    })

    afterEach(async () => {
        await fixture?.teardown()
    })

    describe('HTTP context', () => {
        // HttpException을 던지는 경우
        describe('when an HttpException is thrown', () => {
            // Logger.warn으로 기록한다
            it('logs via Logger.warn', async () => {
                await fixture.httpClient
                    .get('/exception')
                    .notFound({ code: 'ERR_CODE', message: 'message' })

                expect(fixture.spyWarn).toHaveBeenCalledTimes(1)
                expect(fixture.spyWarn).toHaveBeenCalledWith('fail', {
                    statusCode: 404,
                    contextType: 'http',
                    request: { method: 'GET', url: '/exception' },
                    response: { code: 'ERR_CODE', message: 'message' },
                    stack: expect.any(String)
                })
            })
        })

        // Error를 던지는 경우
        describe('when a generic Error is thrown', () => {
            // Logger.error로 기록한다
            it('logs via Logger.error', async () => {
                await fixture.httpClient.get('/error').internalServerError()

                expect(fixture.spyError).toHaveBeenCalledTimes(1)
                expect(fixture.spyError).toHaveBeenCalledWith('error', {
                    statusCode: 500,
                    contextType: 'http',
                    request: { method: 'GET', url: '/error' },
                    response: { message: 'error message' },
                    stack: expect.any(String)
                })
            })
        })

        // Error가 아닌 값을 던지는 경우
        describe('when a non-error is thrown', () => {
            // Logger.fatal로 기록한다
            it('logs via Logger.fatal', async () => {
                await fixture.httpClient.get('/fatal').internalServerError()

                expect(fixture.spyFatal).toHaveBeenCalledTimes(1)
                expect(fixture.spyFatal).toHaveBeenCalledWith('fatal', {
                    statusCode: 500,
                    contextType: 'http',
                    request: { method: 'GET', url: '/fatal' },
                    response: { message: 'fatal error message' },
                    stack: expect.any(String)
                })
            })
        })
    })

    describe('RPC context', () => {
        // HttpException을 던지는 경우
        describe('when an HttpException is thrown', () => {
            // Logger.warn으로 기록한다
            it('logs via Logger.warn', async () => {
                const subject = withTestId('exception')
                await fixture.rpcClient.error(
                    subject,
                    {},
                    expect.objectContaining({
                        response: { code: 'ERR_CODE', message: 'message' },
                        status: 404
                    })
                )

                expect(fixture.spyWarn).toHaveBeenCalledTimes(1)
                expect(fixture.spyWarn).toHaveBeenCalledWith('fail', {
                    contextType: 'rpc',
                    context: { args: [subject] },
                    data: {},
                    response: { code: 'ERR_CODE', message: 'message' },
                    stack: expect.any(String)
                })
            })
        })

        // Error를 던지는 경우
        describe('when a generic Error is thrown', () => {
            // Logger.error로 기록한다
            it('logs via Logger.error', async () => {
                const subject = withTestId('error')
                await fixture.rpcClient.error(subject, {}, Error('error message'))

                expect(fixture.spyError).toHaveBeenCalledTimes(1)
                expect(fixture.spyError).toHaveBeenCalledWith('error', {
                    contextType: 'rpc',
                    context: { args: [subject] },
                    data: {},
                    response: { message: 'error message' },
                    stack: expect.any(String)
                })
            })
        })

        // Error가 아닌 값을 던지는 경우
        describe('when a non-error is thrown', () => {
            // Logger.fatal로 기록한다
            it('logs via Logger.fatal', async () => {
                const subject = withTestId('fatal')
                await fixture.rpcClient.error(subject, {}, Error('fatal error message'))

                expect(fixture.spyFatal).toHaveBeenCalledTimes(1)
                expect(fixture.spyFatal).toHaveBeenCalledWith('fatal', {
                    contextType: 'rpc',
                    context: { args: [subject] },
                    data: {},
                    response: { message: 'fatal error message' },
                    stack: expect.any(String)
                })
            })
        })
    })

    describe('unknown context', () => {
        // ContextType이 알 수 없는 경우
        describe('when the ContextType is unknown', () => {
            // Logger.error로 기록한다
            it('logs via Logger.error', async () => {
                const { ExecutionContextHost } =
                    await import('@nestjs/core/helpers/execution-context-host')
                jest.spyOn(ExecutionContextHost.prototype, 'getType').mockReturnValue('unknown')

                await fixture.httpClient.get('/exception').notFound()

                expect(fixture.spyError).toHaveBeenCalledTimes(1)
                expect(fixture.spyError).toHaveBeenCalledWith(
                    'unknown context type',
                    expect.objectContaining({ contextType: 'unknown' })
                )
            })
        })
    })
})
