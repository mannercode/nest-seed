import type { SuccessLoggerInterceptorFixture } from './success-logger.interceptor.fixture'

describe('HttpSuccessLoggerInterceptor', () => {
    let fix: SuccessLoggerInterceptorFixture

    afterEach(() => fix.teardown())

    describe('요청이 성공하면', () => {
        beforeEach(async () => {
            const { createSuccessLoggerInterceptorFixture } =
                await import('./success-logger.interceptor.fixture')
            fix = await createSuccessLoggerInterceptorFixture([])
        })

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

        // redact의 본격 검증은 redact.spec.ts에 있다. 여기서는 호출 여부만 확인한다.
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
    })

    describe('요청 처리 중 에러가 발생하면', () => {
        beforeEach(async () => {
            const { createSuccessLoggerInterceptorFixture } =
                await import('./success-logger.interceptor.fixture')
            fix = await createSuccessLoggerInterceptorFixture([])
        })

        it('success 로그를 남기지 않는다', async () => {
            await fix.httpClient.get('/failure').internalServerError()

            expect(fix.spyVerbose).not.toHaveBeenCalled()
        })
    })

    describe('LOGGING_EXCLUDE_HTTP_PATHS', () => {
        describe('제외 목록에 요청 경로가 포함되면', () => {
            beforeEach(async () => {
                const { createSuccessLoggerInterceptorFixture } =
                    await import('./success-logger.interceptor.fixture')
                fix = await createSuccessLoggerInterceptorFixture([
                    { provide: 'LOGGING_EXCLUDE_HTTP_PATHS', useValue: ['/exclude-path'] }
                ])
            })

            it('로깅을 건너뛴다', async () => {
                await fix.httpClient.get('/exclude-path').ok({ result: 'success' })

                expect(fix.spyVerbose).toHaveBeenCalledTimes(0)
            })
        })

        describe('제외 목록이 빈 배열이면', () => {
            beforeEach(async () => {
                const { createSuccessLoggerInterceptorFixture } =
                    await import('./success-logger.interceptor.fixture')
                fix = await createSuccessLoggerInterceptorFixture([
                    { provide: 'LOGGING_EXCLUDE_HTTP_PATHS', useValue: [] }
                ])
            })

            it('어떤 경로도 제외하지 않는다', async () => {
                await fix.httpClient.get('/exclude-path').ok({ result: 'success' })

                expect(fix.spyVerbose).toHaveBeenCalledTimes(1)
            })
        })

        describe('제외 목록에 일치하지 않는 경로가 섞여 있으면', () => {
            beforeEach(async () => {
                const { createSuccessLoggerInterceptorFixture } =
                    await import('./success-logger.interceptor.fixture')
                fix = await createSuccessLoggerInterceptorFixture([
                    {
                        provide: 'LOGGING_EXCLUDE_HTTP_PATHS',
                        useValue: ['/never-matches', '/exclude-path']
                    }
                ])
            })

            it('경로가 정확히 일치하는 요청은 로깅을 건너뛴다', async () => {
                await fix.httpClient.get('/exclude-path').ok({ result: 'success' })

                expect(fix.spyVerbose).toHaveBeenCalledTimes(0)
            })
        })
    })
})
