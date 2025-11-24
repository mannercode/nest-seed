import { withTestId } from 'testlib'
import type { Fixture } from './exception-logger.filter.fixture'

describe('ExceptionLoggerFilter', () => {
    let fix: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./exception-logger.filter.fixture')
        fix = await createFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    describe('HTTP context', () => {
        // HttpException을 던지는 경우
        describe('when an HttpException is thrown', () => {
            // Logger.warn으로 기록한다
            it('logs via Logger.warn', async () => {
                await fix.httpClient
                    .get('/exception')
                    .notFound({ code: 'ERR_CODE', message: 'message' })

                expect(fix.spyWarn).toHaveBeenCalledTimes(1)
                expect(fix.spyWarn).toHaveBeenCalledWith('fail', {
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
                await fix.httpClient.get('/error').internalServerError()

                expect(fix.spyError).toHaveBeenCalledTimes(1)
                expect(fix.spyError).toHaveBeenCalledWith('error', {
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
                await fix.httpClient.get('/fatal').internalServerError()

                expect(fix.spyFatal).toHaveBeenCalledTimes(1)
                expect(fix.spyFatal).toHaveBeenCalledWith('fatal', {
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
                await fix.rpcClient.error(
                    subject,
                    {},
                    expect.objectContaining({
                        response: { code: 'ERR_CODE', message: 'message' },
                        status: 404
                    })
                )

                expect(fix.spyWarn).toHaveBeenCalledTimes(1)
                expect(fix.spyWarn).toHaveBeenCalledWith('fail', {
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
                await fix.rpcClient.error(subject, {}, Error('error message'))

                expect(fix.spyError).toHaveBeenCalledTimes(1)
                expect(fix.spyError).toHaveBeenCalledWith('error', {
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
                await fix.rpcClient.error(subject, {}, Error('fatal error message'))

                expect(fix.spyFatal).toHaveBeenCalledTimes(1)
                expect(fix.spyFatal).toHaveBeenCalledWith('fatal', {
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
                const { ExecutionContextHost } = await import(
                    '@nestjs/core/helpers/execution-context-host'
                )
                jest.spyOn(ExecutionContextHost.prototype, 'getType').mockReturnValue('unknown')

                await fix.httpClient.get('/exception').notFound()

                expect(fix.spyError).toHaveBeenCalledTimes(1)
                expect(fix.spyError).toHaveBeenCalledWith(
                    'unknown context type',
                    expect.objectContaining({ contextType: 'unknown' })
                )
            })
        })
    })
})
