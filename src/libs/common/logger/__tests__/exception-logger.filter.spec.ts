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

    // HttpController에서 HttpException을 던지면 Logger.warn()으로 기록해야 한다
    it('Should log HttpExceptions in an HttpController via Logger.warn', async () => {
        await fix.httpClient.get('/exception').notFound({ code: 'ERR_CODE', message: 'message' })

        expect(fix.spyWarn).toHaveBeenCalledTimes(1)
        expect(fix.spyWarn).toHaveBeenCalledWith('fail', {
            statusCode: 404,
            contextType: 'http',
            request: { method: 'GET', url: '/exception' },
            response: { code: 'ERR_CODE', message: 'message' },
            stack: expect.any(String)
        })
    })

    // HttpController에서 Error을 던지면 Logger.error()으로 기록해야 한다
    it('Should log generic Errors in an HttpController via Logger.error', async () => {
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

    // HttpController에서 Error가 아닌 것을 던지면 Logger.fatal()으로 기록해야 한다
    it('Should log non-error events in an HttpController via Logger.fatal', async () => {
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

    // RpcController에서 HttpException을 던지면 Logger.warn()으로 기록해야 한다
    it('Should log HttpExceptions in an RpcController via Logger.warn', async () => {
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

    // RpcController에서 Error을 던지면 Logger.error()으로 기록해야 한다
    it('Should log generic Errors in an RpcController via Logger.error', async () => {
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

    // RpcController에서 Error가 아닌 것을 던지면 Logger.fatal()으로 기록해야 한다
    it('Should log non-error events in an RpcController via Logger.fatal', async () => {
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

    // 알 수 없는 ContextType이면 Logger.error()로 기록해야 한다
    it('Should log as Logger.error() when the ContextType is unknown', async () => {
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
