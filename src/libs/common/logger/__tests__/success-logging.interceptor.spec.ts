import { Provider } from '@nestjs/common'
import { withTestId } from 'testlib'
import type { SuccessLoggingInterceptorFixture } from './success-logging.interceptor.fixture'

describe('SuccessLoggingInterceptor', () => {
    let fix: SuccessLoggingInterceptorFixture
    let createInterceptorFixture: (
        providers: Provider[]
    ) => Promise<SuccessLoggingInterceptorFixture>

    beforeEach(async () => {
        const { createSuccessLoggingInterceptorFixture } =
            await import('./success-logging.interceptor.fixture')
        createInterceptorFixture = createSuccessLoggingInterceptorFixture
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    describe('when the requests succeed', () => {
        beforeEach(async () => {
            fix = await createInterceptorFixture([])
        })

        describe('when an HTTP request succeeds', () => {
            it('logs via Logger.verbose', async () => {
                const body = { key: 'value' }
                await fix.httpClient.post('/success').body(body).created({ result: 'success' })

                expect(fix.spyVerbose).toHaveBeenCalledTimes(1)
                expect(fix.spyVerbose).toHaveBeenCalledWith('success', {
                    statusCode: 201,
                    contextType: 'http',
                    request: { method: 'POST', url: '/success', body },
                    duration: expect.any(String)
                })
            })
        })

        describe('when an RPC request succeeds', () => {
            it('logs via Logger.verbose', async () => {
                const subject = withTestId('success')
                const data = { key: 'value' }
                await fix.rpcClient.expect(subject, data, { result: 'success' })

                expect(fix.spyVerbose).toHaveBeenCalledTimes(1)
                expect(fix.spyVerbose).toHaveBeenCalledWith('success', {
                    contextType: 'rpc',
                    context: { args: [subject] },
                    data,
                    duration: expect.any(String)
                })
            })
        })

        describe('when the ContextType is unknown', () => {
            it('logs via Logger.error', async () => {
                const { ExecutionContextHost } =
                    await import('@nestjs/core/helpers/execution-context-host')
                jest.spyOn(ExecutionContextHost.prototype, 'getType').mockReturnValue('unknown')

                await fix.httpClient.get('/exclude-path').ok()

                expect(fix.spyError).toHaveBeenCalledTimes(1)
                expect(fix.spyError).toHaveBeenCalledWith(
                    'unknown context type',
                    expect.objectContaining({
                        contextType: 'unknown',
                        duration: expect.any(String)
                    })
                )
            })
        })
    })

    describe('when LOGGING_EXCLUDE_HTTP_PATHS includes the request path', () => {
        beforeEach(async () => {
            fix = await createInterceptorFixture([
                { provide: 'LOGGING_EXCLUDE_HTTP_PATHS', useValue: ['/exclude-path'] }
            ])
        })

        it('ignores specified HTTP paths', async () => {
            await fix.httpClient.get('/exclude-path').ok({ result: 'success' })

            expect(fix.spyVerbose).toHaveBeenCalledTimes(0)
        })
    })

    describe('when LOGGING_EXCLUDE_RPC_PATHS includes the subject', () => {
        beforeEach(async () => {
            fix = await createInterceptorFixture([
                { provide: 'LOGGING_EXCLUDE_RPC_PATHS', useValue: [withTestId('exclude-path')] }
            ])
        })

        it('ignores specified RPC paths', async () => {
            const subject = withTestId('exclude-path')
            const data = { key: 'value' }
            await fix.rpcClient.expect(subject, data, { result: 'success' })

            expect(fix.spyVerbose).toHaveBeenCalledTimes(0)
        })
    })
})
