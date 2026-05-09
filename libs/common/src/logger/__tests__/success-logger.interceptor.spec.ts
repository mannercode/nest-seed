import type { SuccessLoggerInterceptorFixture } from './success-logger.interceptor.fixture'

describe('HttpSuccessLoggerInterceptor', () => {
    let fix: SuccessLoggerInterceptorFixture

    describe('요청이 성공할 때', () => {
        beforeEach(async () => {
            const { createSuccessLoggerInterceptorFixture } =
                await import('./success-logger.interceptor.fixture')
            fix = await createSuccessLoggerInterceptorFixture([])
        })
        afterEach(() => fix.teardown())

        describe('요청이 HTTP일 때', () => {
            it('Logger.verbose로 로그를 남긴다', async () => {
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

            it('body의 민감 필드를 [REDACTED]로 마스킹한다', async () => {
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

    describe('LOGGING_EXCLUDE_HTTP_PATHS에 요청 경로가 포함될 때', () => {
        beforeEach(async () => {
            const { createSuccessLoggerInterceptorFixture } =
                await import('./success-logger.interceptor.fixture')
            fix = await createSuccessLoggerInterceptorFixture([
                { provide: 'LOGGING_EXCLUDE_HTTP_PATHS', useValue: ['/exclude-path'] }
            ])
        })
        afterEach(() => fix.teardown())

        it('지정된 HTTP 경로를 무시한다', async () => {
            await fix.httpClient.get('/exclude-path').ok({ result: 'success' })

            expect(fix.spyVerbose).toHaveBeenCalledTimes(0)
        })
    })
})
