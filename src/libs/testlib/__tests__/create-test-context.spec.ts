import { MicroserviceOptions, NatsOptions, Transport } from '@nestjs/microservices'
import {
    HttpTestClient,
    MicroserviceTestClient,
    TestContext,
    createNatsContainers,
    createTestContext
} from 'testlib'
import { SampleModule } from './create-test-context.fixture'

describe('createTestContext', () => {
    let testContext: TestContext
    let microClient: MicroserviceTestClient
    let httpClient: HttpTestClient
    let closeNats: () => Promise<void>

    beforeEach(async () => {
        const { servers, close } = await createNatsContainers()
        closeNats = close

        const brokerOpts = { transport: Transport.NATS, options: { servers } } as NatsOptions

        testContext = await createTestContext({
            metadata: { imports: [SampleModule] },
            configureApp: async (app) => {
                app.connectMicroservice<MicroserviceOptions>(brokerOpts, { inheritAppConfig: true })
                await app.startAllMicroservices()
            }
        })

        microClient = MicroserviceTestClient.create(brokerOpts)
        httpClient = new HttpTestClient(`http://localhost:${testContext.httpPort}`)
    })

    afterEach(async () => {
        await microClient?.close()
        await testContext?.close()
        await closeNats?.()
    })

    it('Microservice 메시지를 전송하면 응답해야 한다', async () => {
        const message = await microClient.send('test.getMicroserviceMessage', { arg: 'value' })

        expect(message).toEqual({ id: 'value' })
    })

    it('Http 메시지를 전송하면 응답해야 한다', async () => {
        const res = await httpClient.get('/message/value').ok()

        expect(res.body).toEqual({ received: 'value' })
    })
})
