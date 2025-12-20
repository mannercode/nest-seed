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
        describe('when the HttpController returns an Observable', () => {
            it('responds with the Observable result', async () => {
                await fix.httpClient.get('/observable').ok({ result: 'success' })
            })
        })

        describe('when the HttpController resolves a value', () => {
            it('returns the Observable value', async () => {
                await fix.httpClient.get('/value').ok({ result: 'success' })
            })
        })

        describe('when the payload is null', () => {
            it('sends a null payload', async () => {
                const response = await fix.rpcClient.getJson(withTestId('method'), null)
                expect(response).toEqual({ result: 'success' })
            })
        })
    })

    describe('emit', () => {
        it('sends the event to the microservice', async () => {
            const promise = new Promise((resolve, reject) => {
                fix.httpClient.get('/handle-event').sse((value) => resolve(value), reject)
            })

            await fix.rpcClient.emit(withTestId('emitEvent'), { arg: 'value' })

            await expect(promise).resolves.toEqual('{"arg":"value"}')
        })

        describe('when the payload is null', () => {
            it('sends a null payload', async () => {
                await fix.rpcClient.emit(withTestId('emitEvent'), null)
            })
        })
    })
})
