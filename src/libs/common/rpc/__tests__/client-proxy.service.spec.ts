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
        describe('when the HttpController returns an Observable', () => {
            it('responds with the Observable result', async () => {
                await fixture.httpClient.get('/observable').ok({ result: 'success' })
            })
        })

        describe('when the HttpController resolves the value', () => {
            it('returns the Observable value', async () => {
                await fixture.httpClient.get('/value').ok({ result: 'success' })
            })
        })

        describe('when the payload is null', () => {
            it('sends a null payload', async () => {
                const response = await fixture.rpcClient.getJson(withTestId('method'), null)
                expect(response).toEqual({ result: 'success' })
            })
        })
    })

    describe('emit', () => {
        describe('when emitting an event', () => {
            it('sends the event to the microservice', async () => {
                const promise = new Promise((resolve, reject) => {
                    fixture.httpClient.get('/handle-event').sse((value) => resolve(value), reject)
                })

                await fixture.rpcClient.emit(withTestId('emitEvent'), { arg: 'value' })

                await expect(promise).resolves.toEqual('{"arg":"value"}')
            })
        })

        describe('when the payload is null', () => {
            it('sends a null payload', async () => {
                await fixture.rpcClient.emit(withTestId('emitEvent'), null)
            })
        })
    })
})
