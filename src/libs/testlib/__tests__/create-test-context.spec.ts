import { HttpTestClient, MicroserviceTestClient, withTestId } from 'testlib'

describe('createTestContext', () => {
    let closeFixture: () => void
    let microClient: MicroserviceTestClient
    let httpClient: HttpTestClient

    beforeEach(async () => {
        const { createFixture } = await import('./create-test-context.fixture')
        const fixture = await createFixture()

        closeFixture = fixture.closeFixture
        microClient = fixture.microClient
        httpClient = fixture.httpClient
    })

    afterEach(async () => {
        await closeFixture?.()
    })

    it('Microservice 메시지를 전송하면 응답해야 한다', async () => {
        const message = await microClient.send(withTestId('subject.getMicroserviceMessage'), {
            arg: 'value'
        })

        expect(message).toEqual({ id: 'value' })
    })

    it('Http 메시지를 전송하면 응답해야 한다', async () => {
        const res = await httpClient.get('/message/value').ok()

        expect(res.body).toEqual({ received: 'value' })
    })
})
