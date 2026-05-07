import type { SuccessLoggerInterceptorFixture } from './success-logger.interceptor.fixture'

describe('HttpSuccessLoggerInterceptor', () => {
    let fix: SuccessLoggerInterceptorFixture

    // 요청이 성공할 때
    describe('when the requests succeed', () => {
        beforeEach(async () => {
            const { createSuccessLoggerInterceptorFixture } =
                await import('./success-logger.interceptor.fixture')
            fix = await createSuccessLoggerInterceptorFixture([])
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
                    contextType: 'http',
                    duration: expect.any(String),
                    request: { body, method: 'POST', url: '/success' },
                    response: { result: 'success' },
                    statusCode: 201
                })
            })

            // body의 민감 필드를 [REDACTED]로 마스킹한다
            it('redacts sensitive fields in the logged body', async () => {
                await fix.httpClient
                    .post('/success')
                    .body({ email: 'a@b.com', password: 'secret', refreshToken: 'r1' })
                    .created({ result: 'success' })

                expect(fix.spyVerbose).toHaveBeenCalledWith(
                    'success',
                    expect.objectContaining({
                        request: expect.objectContaining({
                            body: {
                                email: 'a@b.com',
                                password: '[REDACTED]',
                                refreshToken: '[REDACTED]'
                            }
                        })
                    })
                )
            })
        })
    })

    // LOGGING_EXCLUDE_HTTP_PATHS에 요청 경로가 포함될 때
    describe('when LOGGING_EXCLUDE_HTTP_PATHS includes the request path', () => {
        beforeEach(async () => {
            const { createSuccessLoggerInterceptorFixture } =
                await import('./success-logger.interceptor.fixture')
            fix = await createSuccessLoggerInterceptorFixture([
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
})
