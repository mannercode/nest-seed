import type { SuccessLoggerInterceptorFixture } from './success-logger.interceptor.fixture'

describe('HttpSuccessLoggerInterceptor', () => {
    let fix: SuccessLoggerInterceptorFixture

    describe('성공 요청', () => {
        beforeEach(async () => {
            const { createSuccessLoggerInterceptorFixture } =
                await import('./success-logger.interceptor.fixture')
            fix = await createSuccessLoggerInterceptorFixture([])
        })
        afterEach(() => fix.teardown())

        it('HTTP 요청이 성공하면 Logger.verbose로 로그를 남긴다', async () => {
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

        // redact의 본격 검증은 redact.spec.ts에 있습니다. 여기서는 호출 여부만 확인합니다.
        it('요청 본문의 민감 필드를 [REDACTED]로 마스킹한다', async () => {
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

        it('Observable이 에러로 종료되면 success 로그를 남기지 않는다', async () => {
            await fix.httpClient.get('/failure').internalServerError()

            expect(fix.spyVerbose).not.toHaveBeenCalled()
        })
    })

    describe('LOGGING_EXCLUDE_HTTP_PATHS', () => {
        afterEach(() => fix.teardown())

        it('포함된 경로의 요청은 로깅을 건너뛴다', async () => {
            const { createSuccessLoggerInterceptorFixture } =
                await import('./success-logger.interceptor.fixture')
            fix = await createSuccessLoggerInterceptorFixture([
                { provide: 'LOGGING_EXCLUDE_HTTP_PATHS', useValue: ['/exclude-path'] }
            ])

            await fix.httpClient.get('/exclude-path').ok({ result: 'success' })

            expect(fix.spyVerbose).toHaveBeenCalledTimes(0)
        })

        it('빈 배열이면 어떤 경로도 제외하지 않는다', async () => {
            const { createSuccessLoggerInterceptorFixture } =
                await import('./success-logger.interceptor.fixture')
            fix = await createSuccessLoggerInterceptorFixture([
                { provide: 'LOGGING_EXCLUDE_HTTP_PATHS', useValue: [] }
            ])

            await fix.httpClient.get('/exclude-path').ok({ result: 'success' })

            // 빈 제외 배열이면 모든 경로가 로깅됩니다.
            expect(fix.spyVerbose).toHaveBeenCalledTimes(1)
        })

        it('패턴 중 하나라도 일치하면 로깅을 건너뛴다', async () => {
            const { createSuccessLoggerInterceptorFixture } =
                await import('./success-logger.interceptor.fixture')
            fix = await createSuccessLoggerInterceptorFixture([
                {
                    provide: 'LOGGING_EXCLUDE_HTTP_PATHS',
                    useValue: ['/never-matches', '/exclude-path']
                }
            ])

            await fix.httpClient.get('/exclude-path').ok({ result: 'success' })

            expect(fix.spyVerbose).toHaveBeenCalledTimes(0)
        })
    })
})
