import { withTestId } from 'testlib'
import type { SuccessLoggingInterceptorFixture } from './success-logging.interceptor.fixture'

describe('SuccessLoggingInterceptor', () => {
    let fix: SuccessLoggingInterceptorFixture

    // 요청이 성공할 때
    describe('when the requests succeed', () => {
        beforeEach(async () => {
            const { createSuccessLoggingInterceptorFixture } =
                await import('./success-logging.interceptor.fixture')
            fix = await createSuccessLoggingInterceptorFixture([])
        })
        afterEach(() => fix.teardown())

        // 요청이 HTTP일 때
        describe('when the request is HTTP', () => {
            // Logger.verbose로 로그를 남긴다
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

        // 요청이 RPC일 때
        describe('when the request is RPC', () => {
            // Logger.verbose로 로그를 남긴다
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

        // ContextType이 알 수 없을 때
        describe('when the ContextType is unknown', () => {
            beforeEach(async () => {
                const { ExecutionContextHost } =
                    await import('@nestjs/core/helpers/execution-context-host')
                jest.spyOn(ExecutionContextHost.prototype, 'getType').mockReturnValue('unknown')
            })

            // Logger.error로 로그를 남긴다
            it('logs via Logger.error', async () => {
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

    // LOGGING_EXCLUDE_HTTP_PATHS에 요청 경로가 포함될 때
    describe('when LOGGING_EXCLUDE_HTTP_PATHS includes the request path', () => {
        beforeEach(async () => {
            const { createSuccessLoggingInterceptorFixture } =
                await import('./success-logging.interceptor.fixture')
            fix = await createSuccessLoggingInterceptorFixture([
                { provide: 'LOGGING_EXCLUDE_HTTP_PATHS', useValue: ['/exclude-path'] }
            ])
        })
        afterEach(() => fix.teardown())

        // 지정된 HTTP 경로를 무시한다
        it('ignores specified HTTP paths', async () => {
            await fix.httpClient.get('/exclude-path').ok({ result: 'success' })

            expect(fix.spyVerbose).toHaveBeenCalledTimes(0)
        })
    })

    // LOGGING_EXCLUDE_RPC_PATHS에 subject가 포함될 때
    describe('when LOGGING_EXCLUDE_RPC_PATHS includes the subject', () => {
        beforeEach(async () => {
            const { createSuccessLoggingInterceptorFixture } =
                await import('./success-logging.interceptor.fixture')
            fix = await createSuccessLoggingInterceptorFixture([
                { provide: 'LOGGING_EXCLUDE_RPC_PATHS', useValue: [withTestId('exclude-path')] }
            ])
        })
        afterEach(() => fix.teardown())

        // 지정된 RPC 경로를 무시한다
        it('ignores specified RPC paths', async () => {
            const subject = withTestId('exclude-path')
            const data = { key: 'value' }
            await fix.rpcClient.expect(subject, data, { result: 'success' })

            expect(fix.spyVerbose).toHaveBeenCalledTimes(0)
        })
    })
})
