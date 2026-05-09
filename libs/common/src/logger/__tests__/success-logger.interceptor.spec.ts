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

            // 본 redaction 의 본격 검증은 redact.spec.ts 에서. 여기서는 interceptor 가 redact 를 호출했는지만 확인.
            it('body의 민감 필드를 [REDACTED]로 마스킹한다', async () => {
                await fix.httpClient
                    .post('/success')
                    .body({ password: 'secret' })
                    .created({ result: 'success' })

                expect(fix.spyVerbose).toHaveBeenCalledWith(
                    'success',
                    expect.objectContaining({
                        request: expect.objectContaining({
                            body: expect.objectContaining({ password: '[REDACTED]' })
                        })
                    })
                )
            })

            it.todo(
                'Observable 이 error 로 종료하면 complete 이 발화하지 않아 success 로그가 남지 않는다 (exception filter 와의 책임 분리)'
            )
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

        it.todo('excludeHttpPaths 가 빈 배열이면 어떤 경로도 제외하지 않는다')
        it.todo('excludeHttpPaths 의 어느 한 패턴이라도 일치하면 로깅을 건너뛴다')
    })
})
