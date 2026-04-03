import { withTestId } from '@mannercode/testing'
import { HttpStatus } from '@nestjs/common'
import type { RpcExceptionLoggerFilterFixture } from './rpc-exception-logger.filter.fixture'

describe('RpcExceptionLoggerFilter', () => {
    let fix: RpcExceptionLoggerFilterFixture

    beforeEach(async () => {
        const { createRpcExceptionLoggerFilterFixture } =
            await import('./rpc-exception-logger.filter.fixture')
        fix = await createRpcExceptionLoggerFilterFixture()
    })
    afterEach(() => fix.teardown())

    describe('HTTP context', () => {
        // HttpException이 발생할 때
        describe('when an HttpException is thrown', () => {
            // Logger.warn으로 로그를 남긴다
            it('logs via Logger.warn', async () => {
                await fix.httpClient
                    .get('/exception')
                    .notFound({ code: 'ERR_CODE', message: 'message' })

                expect(fix.spyWarn).toHaveBeenCalledTimes(1)
                expect(fix.spyWarn).toHaveBeenCalledWith('fail', {
                    contextType: 'http',
                    duration: expect.any(String),
                    request: { method: 'GET', url: '/exception' },
                    response: { code: 'ERR_CODE', message: 'message' },
                    stack: expect.any(Array),
                    statusCode: 404
                })
            })
        })

        // 일반 Error가 발생할 때
        describe('when a generic Error is thrown', () => {
            // Logger.error로 로그를 남긴다
            it('logs via Logger.error', async () => {
                await fix.httpClient.get('/error').internalServerError()

                expect(fix.spyError).toHaveBeenCalledTimes(1)
                expect(fix.spyError).toHaveBeenCalledWith('error', {
                    contextType: 'http',
                    duration: expect.any(String),
                    request: { method: 'GET', url: '/error' },
                    response: { message: 'error message' },
                    stack: expect.any(Array),
                    statusCode: 500
                })
            })
        })
    })

    describe('RPC context', () => {
        // HttpException이 발생할 때
        describe('when an HttpException is thrown', () => {
            // Logger.warn으로 로그를 남긴다
            it('logs via Logger.warn', async () => {
                const subject = withTestId('exception')
                await fix.rpcClient.expectError(
                    subject,
                    {},
                    expect.objectContaining({
                        response: { code: 'ERR_CODE', message: 'message' },
                        status: HttpStatus.NOT_FOUND
                    })
                )

                expect(fix.spyWarn).toHaveBeenCalledTimes(1)
                expect(fix.spyWarn).toHaveBeenCalledWith('fail', {
                    contextType: 'rpc',
                    duration: expect.any(String),
                    request: { subject, data: {} },
                    response: { code: 'ERR_CODE', message: 'message' },
                    stack: expect.any(Array)
                })
            })
        })

        // 일반 Error가 발생할 때
        describe('when a generic Error is thrown', () => {
            // Logger.error로 로그를 남긴다
            it('logs via Logger.error', async () => {
                const subject = withTestId('error')
                await fix.rpcClient.expectError(subject, {}, Error('error message'))

                expect(fix.spyError).toHaveBeenCalledTimes(1)
                expect(fix.spyError).toHaveBeenCalledWith('error', {
                    contextType: 'rpc',
                    duration: expect.any(String),
                    request: { subject, data: {} },
                    response: { message: 'error message' },
                    stack: expect.any(Array)
                })
            })
        })
    })

    // ContextType이 알 수 없을 때
    describe('when the ContextType is unknown', () => {
        beforeEach(async () => {
            const { ExecutionContextHost } =
                await import('@nestjs/core/helpers/execution-context-host')
            jest.spyOn(ExecutionContextHost.prototype, 'getType').mockReturnValue('unknown')
        })

        // Logger.error로 로그를 남긴다
        it('logs via Logger.error', async () => {
            await fix.httpClient.get('/exception').notFound()

            expect(fix.spyError).toHaveBeenCalledTimes(1)
            expect(fix.spyError).toHaveBeenCalledWith(
                'unknown context type',
                expect.objectContaining({ contextType: 'unknown' })
            )
        })
    })
})
