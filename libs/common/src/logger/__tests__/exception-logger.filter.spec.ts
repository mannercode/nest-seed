import type { ExceptionLoggerFilterFixture } from './exception-logger.filter.fixture'

describe('HttpExceptionLoggerFilter', () => {
    let fix: ExceptionLoggerFilterFixture

    beforeEach(async () => {
        const { createExceptionLoggerFilterFixture } =
            await import('./exception-logger.filter.fixture')
        fix = await createExceptionLoggerFilterFixture()
    })
    afterEach(() => fix.teardown())

    describe('HTTP 컨텍스트', () => {
        it('HttpException이 발생하면 Logger.warn으로 로그를 남긴다', async () => {
            await fix.httpClient
                .get('/exception')
                .notFound({ code: 'ERR_CODE', message: 'message' })

            expect(fix.spyWarn).toHaveBeenCalledTimes(1)
            expect(fix.spyWarn).toHaveBeenCalledWith('fail', {
                contextType: 'http',
                duration: expect.any(String),
                request: { method: 'GET', url: '/exception' },
                response: { code: 'ERR_CODE', message: 'message' },
                stack: expect.any(Array),
                statusCode: 404
            })
        })

        it.todo('4xx HttpException(401, 422)도 4xx 카테고리로 redact 후 로깅된다')
        it.todo('HttpException.getResponse()가 string이어도 redact가 안전하게 통과한다')

        // redact의 본격 검증은 redact.spec.ts에 있다. 여기선 호출 여부만 확인.
        it('요청 body에 password가 있으면 [REDACTED]로 마스킹한다', async () => {
            await fix.httpClient.post('/exception').body({ password: 'secret' }).notFound()

            expect(fix.spyWarn).toHaveBeenCalledWith(
                'fail',
                expect.objectContaining({
                    request: expect.objectContaining({
                        body: expect.objectContaining({ password: '[REDACTED]' })
                    })
                })
            )
        })

        it('일반 Error가 발생하면 Logger.error로 로그를 남긴다', async () => {
            await fix.httpClient.get('/error').internalServerError()

            expect(fix.spyError).toHaveBeenCalledTimes(1)
            expect(fix.spyError).toHaveBeenCalledWith('error', {
                contextType: 'http',
                duration: expect.any(String),
                request: { method: 'GET', url: '/error' },
                response: { message: 'error message' },
                stack: expect.any(Array),
                statusCode: 500
            })
        })

        it.todo('@Catch(Error)는 Error 인스턴스가 아닌 throw(문자열, 숫자 등)는 잡지 않는다')

        it.todo('contextType이 http가 아니면 Logger.error에 unknown context type 메시지를 남긴다')
    })

    // success interceptor 없이 filter 단독으로 등록된 경우.
    describe('HttpSuccessLoggerInterceptor 없이', () => {
        let solo: ExceptionLoggerFilterFixture

        beforeEach(async () => {
            const { createExceptionLoggerFilterFixture } =
                await import('./exception-logger.filter.fixture')
            solo = await createExceptionLoggerFilterFixture({ withInterceptor: false })
        })
        afterEach(() => solo.teardown())

        it('_startTimestamp가 없어도 duration을 산출해 로그를 남긴다', async () => {
            await solo.httpClient.get('/exception').notFound()

            expect(solo.spyWarn).toHaveBeenCalledWith(
                'fail',
                expect.objectContaining({ duration: expect.stringMatching(/^\d+ms$/) })
            )
        })
    })
})
