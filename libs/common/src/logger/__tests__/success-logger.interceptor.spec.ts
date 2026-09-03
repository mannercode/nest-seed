import {
    type SuccessLoggerInterceptorFixture,
    createSuccessLoggerInterceptorFixture
} from './success-logger.interceptor.fixture.js'

describe('HttpSuccessLoggerInterceptor', () => {
    let fix: SuccessLoggerInterceptorFixture

    afterEach(() => fix.teardown())

    describe('요청이 성공하면', () => {
        beforeEach(async () => {
            fix = await createSuccessLoggerInterceptorFixture([])
        })

        it('Logger.verbose로 로그를 남긴다', async () => {
            await fix.httpClient
                .post('/success?token=query-secret')
                .body({ password: 'request-secret' })
                .created({ result: 'success' })

            expect(fix.spyVerbose).toHaveBeenCalledTimes(1)
            expect(fix.spyVerbose).toHaveBeenCalledWith('success', {
                contextType: 'http',
                duration: expect.any(String),
                request: { method: 'POST', route: '/success' },
                statusCode: 201
            })
        })

        it('요청·응답 본문을 로그에 포함하지 않는다', async () => {
            await fix.httpClient
                .post('/success')
                .body({ password: 'request-secret' })
                .created({ result: 'success' })

            const log = fix.spyVerbose.mock.calls[0]?.[1]
            expect(log).not.toHaveProperty('response')
            expect(log.request).not.toHaveProperty('body')
            expect(JSON.stringify(log)).not.toContain('request-secret')
        })
    })

    describe('요청 처리 중 에러가 발생하면', () => {
        beforeEach(async () => {
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
                fix = await createSuccessLoggerInterceptorFixture([
                    { provide: 'LOGGING_EXCLUDE_HTTP_PATHS', useValue: ['/exclude-path'] }
                ])
            })

            it('로깅을 건너뛴다', async () => {
                await fix.httpClient.get('/exclude-path').ok({ result: 'success' })

                expect(fix.spyVerbose).toHaveBeenCalledTimes(0)
            })
        })

        describe('제외 경로의 하위 경로를 요청하면', () => {
            beforeEach(async () => {
                fix = await createSuccessLoggerInterceptorFixture([
                    { provide: 'LOGGING_EXCLUDE_HTTP_PATHS', useValue: ['/exclude-path'] }
                ])
            })

            it('경로가 정확히 일치하지 않으므로 로그를 남긴다', async () => {
                await fix.httpClient.get('/exclude-path/sub').ok({ result: 'success' })

                expect(fix.spyVerbose).toHaveBeenCalledTimes(1)
            })
        })

        describe('제외 목록이 빈 배열이면', () => {
            beforeEach(async () => {
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
