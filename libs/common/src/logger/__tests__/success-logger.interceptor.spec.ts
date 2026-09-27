import {
    type SuccessLoggerInterceptorFixture,
    createSuccessLoggerInterceptorFixture
} from './success-logger.interceptor.fixture.js'

describe('HttpSuccessLoggerInterceptor', () => {
    let fix: SuccessLoggerInterceptorFixture

    afterEach(() => fix.teardown())

    describe('제외 경로를 설정하지 않았으면', () => {
        beforeEach(async () => {
            fix = await createSuccessLoggerInterceptorFixture([])
        })

        it('성공하는 경로로 요청하면 Logger.verbose로 로그를 남긴다', async () => {
            await fix.httpClient
                .post('/success?token=query-secret')
                .body({ password: 'request-secret' })
                .created({ expected: { result: 'success' } })

            expect(fix.spyVerbose).toHaveBeenCalledTimes(1)
            expect(fix.spyVerbose).toHaveBeenCalledWith('success', {
                contextType: 'http',
                duration: expect.any(String),
                request: { method: 'POST', route: '/success' },
                statusCode: 201
            })
        })

        it('성공한 요청의 로그에는 요청·응답 본문을 포함하지 않는다', async () => {
            await fix.httpClient
                .post('/success')
                .body({ password: 'request-secret' })
                .created({ expected: { result: 'success' } })

            const log = fix.spyVerbose.mock.calls[0]?.[1]
            expect(log).not.toHaveProperty('response')
            expect(log.request).not.toHaveProperty('body')
            expect(JSON.stringify(log)).not.toContain('request-secret')
        })

        it('오류가 발생하는 경로로 요청하면 success 로그를 남기지 않는다', async () => {
            await fix.httpClient.get('/failure').internalServerError()

            expect(fix.spyVerbose).not.toHaveBeenCalled()
        })
    })

    describe('LOGGING_EXCLUDE_HTTP_PATHS', () => {
        describe('제외 목록에 /exclude-path가 있으면', () => {
            beforeEach(async () => {
                fix = await createSuccessLoggerInterceptorFixture([
                    { provide: 'LOGGING_EXCLUDE_HTTP_PATHS', useValue: ['/exclude-path'] }
                ])
            })

            it('제외 경로로 요청하면 로그를 남기지 않는다', async () => {
                await fix.httpClient.get('/exclude-path').ok({ expected: { result: 'success' } })

                expect(fix.spyVerbose).toHaveBeenCalledTimes(0)
            })

            it('제외 경로의 하위 경로로 요청하면 로그를 남긴다', async () => {
                await fix.httpClient
                    .get('/exclude-path/sub')
                    .ok({ expected: { result: 'success' } })

                expect(fix.spyVerbose).toHaveBeenCalledTimes(1)
            })
        })

        describe('제외 목록이 빈 배열이면', () => {
            beforeEach(async () => {
                fix = await createSuccessLoggerInterceptorFixture([
                    { provide: 'LOGGING_EXCLUDE_HTTP_PATHS', useValue: [] }
                ])
            })

            it('/exclude-path로 요청하면 로그를 남긴다', async () => {
                await fix.httpClient.get('/exclude-path').ok({ expected: { result: 'success' } })

                expect(fix.spyVerbose).toHaveBeenCalledTimes(1)
            })
        })

        describe('제외 목록에 두 경로가 있으면', () => {
            beforeEach(async () => {
                fix = await createSuccessLoggerInterceptorFixture([
                    {
                        provide: 'LOGGING_EXCLUDE_HTTP_PATHS',
                        useValue: ['/never-matches', '/exclude-path']
                    }
                ])
            })

            it('목록의 두 번째 경로로 요청해도 로그를 남기지 않는다', async () => {
                await fix.httpClient.get('/exclude-path').ok({ expected: { result: 'success' } })

                expect(fix.spyVerbose).toHaveBeenCalledTimes(0)
            })
        })
    })
})
