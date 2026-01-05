import { withTestId } from 'testlib'
import type { ClientProxyServiceFixture } from './client-proxy.service.fixture'

describe('ClientProxyService', () => {
    let fix: ClientProxyServiceFixture

    beforeEach(async () => {
        const { createClientProxyServiceFixture } = await import('./client-proxy.service.fixture')
        fix = await createClientProxyServiceFixture()
    })
    afterEach(() => fix.teardown())

    describe('send', () => {
        // HttpController가 Observable을 반환할 때
        describe('when the HttpController returns an Observable', () => {
            // Observable 결과로 응답한다
            it('responds with the Observable result', async () => {
                await fix.httpClient.get('/observable').ok({ result: 'success' })
            })
        })

        // HttpController가 값을 resolve할 때
        describe('when the HttpController resolves a value', () => {
            // Observable 값을 반환한다
            it('returns the Observable value', async () => {
                await fix.httpClient.get('/value').ok({ result: 'success' })
            })
        })

        // 페이로드가 null일 때
        describe('when the payload is null', () => {
            // null 페이로드를 전송한다
            it('sends a null payload', async () => {
                const response = await fix.rpcClient.request(withTestId('method'), null)
                expect(response).toEqual({ result: 'success' })
            })
        })
    })

    describe('emit', () => {
        // 이벤트를 마이크로서비스로 전송한다
        it('sends the event to the microservice', async () => {
            const promise = new Promise((resolve, reject) => {
                fix.httpClient.get('/handle-event').sse((value) => resolve(value), reject)
            })

            await fix.rpcClient.emit(withTestId('emitEvent'), { arg: 'value' })

            await expect(promise).resolves.toEqual('{"arg":"value"}')
        })

        // 페이로드가 null일 때
        describe('when the payload is null', () => {
            // null 페이로드를 전송한다
            it('sends a null payload', async () => {
                await fix.rpcClient.emit(withTestId('emitEvent'), null)
            })
        })
    })
})
