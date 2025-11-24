import { withTestId } from 'testlib'
import type { Fixture } from './client-proxy.service.fixture'

describe('ClientProxyService', () => {
    let fixture: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./client-proxy.service.fixture')
        fixture = await createFixture()
    })

    afterEach(async () => {
        await fixture?.teardown()
    })

    describe('send', () => {
        // HttpController에서 Observable을 반환하는 경우
        describe('when HttpController returns an Observable', () => {
            // Observable 응답을 전달한다
            it('responds with the Observable result', async () => {
                await fixture.httpClient.get('/observable').ok({ result: 'success' })
            })
        })

        // HttpController가 Observable의 값을 반환하는 경우
        describe('when HttpController resolves the value', () => {
            // 값을 반환한다
            it('returns the Observable value', async () => {
                await fixture.httpClient.get('/value').ok({ result: 'success' })
            })
        })

        // payload가 null인 경우
        describe('when payload is null', () => {
            // null payload를 전송한다
            it('sends a null payload', async () => {
                const response = await fixture.rpcClient.getJson(withTestId('method'), null)
                expect(response).toEqual({ result: 'success' })
            })
        })
    })

    describe('emit', () => {
        // 이벤트를 전송하는 경우
        describe('when emitting an event', () => {
            // 마이크로서비스로 이벤트를 전달한다
            it('sends the event to the microservice', async () => {
                const promise = new Promise((resolve, reject) => {
                    fixture.httpClient.get('/handle-event').sse((value) => resolve(value), reject)
                })

                await fixture.rpcClient.emit(withTestId('emitEvent'), { arg: 'value' })

                await expect(promise).resolves.toEqual('{"arg":"value"}')
            })
        })

        // payload가 null인 경우
        describe('when payload is null', () => {
            // null payload를 전송한다
            it('sends a null payload', async () => {
                await fixture.rpcClient.emit(withTestId('emitEvent'), null)
            })
        })
    })
})
