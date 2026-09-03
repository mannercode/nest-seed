import type { ArgumentsHost } from '@nestjs/common'
import { HttpExceptionLoggerFilter } from '../index.js'
import {
    type ExceptionLoggerFilterFixture,
    createExceptionLoggerFilterFixture
} from './exception-logger.filter.fixture.js'

describe('HttpExceptionLoggerFilter', () => {
    let fix: ExceptionLoggerFilterFixture

    beforeEach(async () => {
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
                error: { code: 'ERR_CODE', name: 'NotFoundException' },
                request: { method: 'GET', route: '/exception' },
                stack: expect.any(Array),
                statusCode: 404
            })
        })

        it('매칭되지 않은 경로는 실제 요청 경로로 기록한다', async () => {
            await fix.httpClient.get('/missing-route').notFound()

            expect(fix.spyWarn).toHaveBeenCalledWith(
                'fail',
                expect.objectContaining({ request: { method: 'GET', route: '/missing-route' } })
            )
        })

        it('401 HttpException도 Logger.warn으로 로그를 남긴다', async () => {
            await fix.httpClient.get('/unauthorized').unauthorized()

            expect(fix.spyWarn).toHaveBeenCalledWith(
                'fail',
                expect.objectContaining({ statusCode: 401 })
            )
        })

        it('422 HttpException도 Logger.warn으로 로그를 남긴다', async () => {
            await fix.httpClient.get('/unprocessable').unprocessableEntity()

            expect(fix.spyWarn).toHaveBeenCalledWith(
                'fail',
                expect.objectContaining({ statusCode: 422 })
            )
        })

        it('HttpException 응답이 문자열이어도 안정적인 오류 정보만 기록한다', async () => {
            await fix.httpClient.get('/string-response').badRequest()

            expect(fix.spyWarn).toHaveBeenCalledWith(
                'fail',
                expect.objectContaining({ error: { name: 'HttpException' }, statusCode: 400 })
            )
        })

        it('요청 본문과 query를 오류 로그에 포함하지 않는다', async () => {
            await fix.httpClient
                .post('/exception?token=query-secret')
                .body({ password: 'request-secret' })
                .notFound()

            const log = fix.spyWarn.mock.calls[0]?.[1]
            expect(log).not.toHaveProperty('response')
            expect(log.request).toEqual({ method: 'POST', route: '/exception' })
            expect(JSON.stringify(log)).not.toContain('request-secret')
            expect(JSON.stringify(log)).not.toContain('query-secret')
        })

        it('duration을 인터셉터가 마크한 요청 진입 시각부터 계산한다', async () => {
            await fix.httpClient.get('/slow-exception').notFound()

            expect(fix.spyWarn).toHaveBeenCalledTimes(1)
            const firstCall = fix.spyWarn.mock.calls[0]
            if (!firstCall) throw new Error('Logger.warn must be called')
            const [, log] = firstCall
            // 핸들러가 50ms 지연 후 던지므로 마크가 빠지면 0ms로 퇴행한다. 부하는 값을
            // 키우는 방향으로만 작용하므로 타이머 오차 여유를 둔 하한만 단언한다.
            expect(parseInt(log.duration)).toBeGreaterThanOrEqual(40)
        })

        it('일반 Error가 발생하면 Logger.error로 로그를 남긴다', async () => {
            await fix.httpClient.get('/error').internalServerError()

            expect(fix.spyError).toHaveBeenCalledTimes(1)
            expect(fix.spyError).toHaveBeenCalledWith('error', {
                contextType: 'http',
                duration: expect.any(String),
                error: { name: 'Error' },
                request: { method: 'GET', route: '/error' },
                stack: expect.any(Array),
                statusCode: 500
            })
        })

        it('@Catch(Error)는 문자열처럼 Error가 아닌 값은 처리하지 않는다', async () => {
            await fix.httpClient.get('/throw-string').internalServerError()

            expect(fix.spyError).not.toHaveBeenCalledWith('error', expect.anything())
            expect(fix.spyWarn).not.toHaveBeenCalledWith('fail', expect.anything())
        })
    })

    describe('HTTP가 아닌 컨텍스트에서 실행되면', () => {
        let filter: HttpExceptionLoggerFilter
        let fakeHost: ArgumentsHost

        beforeEach(async () => {
            filter = new HttpExceptionLoggerFilter()
            fakeHost = {
                getType: () => 'rpc',
                getArgs: () => [],
                getArgByIndex: () => undefined,
                switchToHttp: () => ({ getRequest: () => ({}), getResponse: () => ({}) }),
                switchToRpc: () => ({}),
                switchToWs: () => ({})
            } as any
        })

        it('알 수 없는 컨텍스트 메시지를 Logger.error로 남긴다', () => {
            try {
                filter.catch(new Error('boom'), fakeHost)
            } catch {
                // super.catch가 예외를 던질 수 있지만 이 단언과는 무관하다.
            }

            expect(fix.spyError).toHaveBeenCalledWith(
                'HttpExceptionLoggerFilter: unknown context type',
                expect.objectContaining({ contextType: 'rpc' })
            )
        })
    })

    describe('HttpSuccessLoggerInterceptor가 등록되지 않았을 때', () => {
        let solo: ExceptionLoggerFilterFixture

        beforeEach(async () => {
            solo = await createExceptionLoggerFilterFixture({ withInterceptor: false })
        })
        afterEach(() => solo.teardown())

        it('markRequestStart가 호출되지 않은 요청도 duration을 산출해 로그를 남긴다', async () => {
            await solo.httpClient.get('/exception').notFound()

            expect(solo.spyWarn).toHaveBeenCalledWith(
                'fail',
                expect.objectContaining({ duration: expect.stringMatching(/^\d+ms$/) })
            )
        })
    })
})
