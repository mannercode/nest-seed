import { Provider } from '@nestjs/common'
import { withTestId } from 'testlib'
import type { Fixture } from './success-logging.interceptor.fixture'

describe('SuccessLoggingInterceptor', () => {
    let fixture: Fixture
    let createFixture: (providers: Provider[]) => Promise<any>

    beforeEach(async () => {
        const { createFixture: _createFixture } = await import(
            './success-logging.interceptor.fixture'
        )
        createFixture = _createFixture
    })

    afterEach(async () => {
        await fixture?.teardown()
    })

    // 요청이 성공하는 경우
    describe('when requests succeed', () => {
        beforeEach(async () => {
            fixture = await createFixture([])
        })

        // HTTP 요청이 성공하는 경우
        describe('when an HTTP request succeeds', () => {
            // Logger.verbose로 기록한다
            it('logs via Logger.verbose', async () => {
                const body = { key: 'value' }
                await fixture.httpClient.post('/success').body(body).created({ result: 'success' })

                expect(fixture.spyVerbose).toHaveBeenCalledTimes(1)
                expect(fixture.spyVerbose).toHaveBeenCalledWith('success', {
                    statusCode: 201,
                    contextType: 'http',
                    request: { method: 'POST', url: '/success', body },
                    duration: expect.any(String)
                })
            })
        })

        // RPC 요청이 성공하는 경우
        describe('when an RPC request succeeds', () => {
            // Logger.verbose로 기록한다
            it('logs via Logger.verbose', async () => {
                const subject = withTestId('success')
                const data = { key: 'value' }
                await fixture.rpcClient.expect(subject, data, { result: 'success' })

                expect(fixture.spyVerbose).toHaveBeenCalledTimes(1)
                expect(fixture.spyVerbose).toHaveBeenCalledWith('success', {
                    contextType: 'rpc',
                    context: { args: [subject] },
                    data,
                    duration: expect.any(String)
                })
            })
        })

        // ContextType이 알 수 없는 경우
        describe('when the ContextType is unknown', () => {
            // Logger.error로 기록한다
            it('logs via Logger.error', async () => {
                const { ExecutionContextHost } = await import(
                    '@nestjs/core/helpers/execution-context-host'
                )
                jest.spyOn(ExecutionContextHost.prototype, 'getType').mockReturnValue('unknown')

                await fixture.httpClient.get('/exclude-path').ok()

                expect(fixture.spyError).toHaveBeenCalledTimes(1)
                expect(fixture.spyError).toHaveBeenCalledWith(
                    'unknown context type',
                    expect.objectContaining({
                        contextType: 'unknown',
                        duration: expect.any(String)
                    })
                )
            })
        })
    })

    describe('LOGGING_EXCLUDE_HTTP_PATHS', () => {
        beforeEach(async () => {
            fixture = await createFixture([
                { provide: 'LOGGING_EXCLUDE_HTTP_PATHS', useValue: ['/exclude-path'] }
            ])
        })

        // 지정된 HTTP 경로는 무시해야 한다
        it('ignores specified HTTP paths', async () => {
            await fixture.httpClient.get('/exclude-path').ok({ result: 'success' })

            expect(fixture.spyVerbose).toHaveBeenCalledTimes(0)
        })
    })

    describe('LOGGING_EXCLUDE_RPC_PATHS', () => {
        beforeEach(async () => {
            fixture = await createFixture([
                { provide: 'LOGGING_EXCLUDE_RPC_PATHS', useValue: [withTestId('exclude-path')] }
            ])
        })

        // 지정된 RPC 경로는 무시해야 한다
        it('ignores specified RPC paths', async () => {
            const subject = withTestId('exclude-path')
            const data = { key: 'value' }
            await fixture.rpcClient.expect(subject, data, { result: 'success' })

            expect(fixture.spyVerbose).toHaveBeenCalledTimes(0)
        })
    })
})
