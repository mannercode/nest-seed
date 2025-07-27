import { Provider } from '@nestjs/common'
import { withTestId } from 'testlib'
import type { Fixture } from './success-logging.interceptor.fixture'

describe('SuccessLoggingInterceptor', () => {
    let fix: Fixture
    let createFixture: (providers: Provider[]) => Promise<any>

    beforeEach(async () => {
        const { createFixture: _createFixture } = await import(
            './success-logging.interceptor.fixture'
        )
        createFixture = _createFixture
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    // 요청 성공 시
    describe('When requests succeed', () => {
        beforeEach(async () => {
            fix = await createFixture([])
        })

        // HTTP 요청이 성공하면 Logger.verbose()로 기록해야 한다
        it('Should log successful HTTP requests via Logger.verbose', async () => {
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

        // RPC 요청이 성공하면 Logger.verbose()로 기록해야 한다
        it('Should log successful RPC requests via Logger.verbose', async () => {
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

        // 알 수 없는 ContextType이면 Logger.error()로 기록해야 한다
        it('Should log an error via Logger.error() if the ContextType is unknown', async () => {
            const { ExecutionContextHost } = await import(
                '@nestjs/core/helpers/execution-context-host'
            )
            jest.spyOn(ExecutionContextHost.prototype, 'getType').mockReturnValue('unknown')

            await fix.httpClient.get('/exclude-path').ok()

            expect(fix.spyError).toHaveBeenCalledTimes(1)
            expect(fix.spyError).toHaveBeenCalledWith(
                'unknown context type',
                expect.objectContaining({ contextType: 'unknown', duration: expect.any(String) })
            )
        })
    })

    describe('LOGGING_EXCLUDE_HTTP_PATHS', () => {
        beforeEach(async () => {
            fix = await createFixture([
                { provide: 'LOGGING_EXCLUDE_HTTP_PATHS', useValue: ['/exclude-path'] }
            ])
        })

        // 지정된 HTTP 경로는 무시해야 한다
        it('Should ignore specified HTTP paths', async () => {
            await fix.httpClient.get('/exclude-path').ok({ result: 'success' })

            expect(fix.spyVerbose).toHaveBeenCalledTimes(0)
        })
    })

    describe('LOGGING_EXCLUDE_RPC_PATHS', () => {
        beforeEach(async () => {
            fix = await createFixture([
                { provide: 'LOGGING_EXCLUDE_RPC_PATHS', useValue: [withTestId('exclude-path')] }
            ])
        })

        // 지정된 RPC 경로는 무시해야 한다
        it('Should ignore specified RPC paths', async () => {
            const subject = withTestId('exclude-path')
            const data = { key: 'value' }
            await fix.rpcClient.expect(subject, data, { result: 'success' })

            expect(fix.spyVerbose).toHaveBeenCalledTimes(0)
        })
    })
})
