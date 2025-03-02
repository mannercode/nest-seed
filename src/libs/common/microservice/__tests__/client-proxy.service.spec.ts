import { CloseFixture, HttpTestClient } from 'testlib'

describe('ClientProxyService', () => {
    let closeFixture: CloseFixture
    let client: HttpTestClient

    beforeEach(async () => {
        const { createFixture } = await import('./client-proxy.service.fixture')

        const fixture = await createFixture()
        closeFixture = fixture.closeFixture
        client = fixture.client
    })

    afterEach(async () => {
        await closeFixture?.()
    })

    describe('send', () => {
        it('HttpController는 Observable로 응답할 수 있다', async () => {
            await client.get('/observable').ok({ result: 'success' })
        })

        it('HttpController는 Observable의 값을 읽어서 반환할 수 있다', async () => {
            await client.get('/value').ok({ result: 'success' })
        })

        it('null payload를 보낼 수 있다', async () => {
            await client.get('/send-null').ok({ result: 'success' })
        })
    })

    describe('emit', () => {
        it('Microservice 이벤트를 전송해야 한다', async () => {
            const promise = new Promise((resolve, reject) => {
                client.get('/handle-event').sse((value) => resolve(value), reject)
            })

            await client.get('/emit-event').ok()
            await expect(promise).resolves.toEqual('{"arg":"value"}')
        })

        it('null payload를 보낼 수 있다', async () => {
            await client.get('/emit-null').ok()
        })
    })
})
