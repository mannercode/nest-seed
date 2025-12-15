import { withTestId } from 'testlib'
import type { ExceptionLoggerFilterFixture } from './exception-logger.filter.fixture'
import { HttpStatus } from '@nestjs/common'

describe('ExceptionLoggerFilter', () => {
    let fix: ExceptionLoggerFilterFixture

    beforeEach(async () => {
        const { createExceptionLoggerFilterFixture } =
            await import('./exception-logger.filter.fixture')
        fix = await createExceptionLoggerFilterFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    describe('HTTP context', () => {
        it('logs via Logger.warn for an HttpException', async () => {
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

        it('logs via Logger.error for a generic Error', async () => {
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

        it('logs via Logger.fatal for a non-error throw', async () => {
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

    describe('RPC context', () => {
        it('logs via Logger.warn for an HttpException', async () => {
            const subject = withTestId('exception')
            await fix.rpcClient.error(
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
                context: { args: [subject] },
                data: {},
                response: { code: 'ERR_CODE', message: 'message' },
                stack: expect.any(String)
            })
        })

        it('logs via Logger.error for a generic Error', async () => {
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

        it('logs via Logger.fatal for a non-error throw', async () => {
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

    it('logs via Logger.error when the ContextType is unknown', async () => {
        const { ExecutionContextHost } = await import('@nestjs/core/helpers/execution-context-host')
        jest.spyOn(ExecutionContextHost.prototype, 'getType').mockReturnValue('unknown')

        await fix.httpClient.get('/exception').notFound()

        expect(fix.spyError).toHaveBeenCalledTimes(1)
        expect(fix.spyError).toHaveBeenCalledWith(
            'unknown context type',
            expect.objectContaining({ contextType: 'unknown' })
        )
    })
})
