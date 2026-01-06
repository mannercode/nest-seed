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
            // resolve된 값으로 응답한다
            it('returns the resolved value', async () => {
                await fix.httpClient.get('/promise').ok({ result: 'success' })
            })
        })

        // null 페이로드로도 응답한다
        it('responds when payload is null', async () => {
            const response = await fix.rpcClient.request(withTestId('method'), null)
            expect(response).toEqual({ result: 'success' })
        })

        // 메시지 큐가 존재하지 않을 때
        describe('when the queue does not exist', () => {
            // 응답이 비어 있으면 예외를 던진다
            it('throws for empty response', async () => {
                const promise = fix.rpcClient.request('unknown.queue', null)
                await expect(promise).rejects.toThrow(/empty response/i)
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

        // 페이로드가 null인 때
        describe('when payload is null', () => {
            // 예외가 발생하지 않는다
            it('does not throw when payload is null', async () => {
                const promise = fix.rpcClient.emit(withTestId('emitEvent'), null)
                await expect(promise).resolves.toBeUndefined()
            })
        })
    })
})
