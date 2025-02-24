import { Controller, Get, Param } from '@nestjs/common'
import {
    MessagePattern,
    MicroserviceOptions,
    NatsOptions,
    Payload,
    Transport
} from '@nestjs/microservices'
import { createTestContext } from '../create-test-context'
import { HttpTestClient } from '../http.test-client'
import { MicroserviceTestClient } from '../microservice.test-client'
import { getNatsTestConnection } from '../test-containers'
import { withTestId } from '../utils'

@Controller()
class SampleController {
    @MessagePattern(withTestId('subject.getMicroserviceMessage'))
    getMicroserviceMessage(@Payload() request: { arg: string }) {
        return { id: request.arg }
    }

    @Get('message/:arg')
    async getHttpMessage(@Param('arg') arg: string) {
        return { received: arg }
    }
}

export async function createFixture() {
    const { servers } = await getNatsTestConnection()

    const brokerOpts = { transport: Transport.NATS, options: { servers } } as NatsOptions

    const testContext = await createTestContext({
        metadata: { controllers: [SampleController] },
        configureApp: async (app) => {
            app.connectMicroservice<MicroserviceOptions>(brokerOpts, { inheritAppConfig: true })
            await app.startAllMicroservices()
        }
    })

    const microClient = MicroserviceTestClient.create(brokerOpts)
    const httpClient = new HttpTestClient(testContext.httpPort)

    const closeFixture = async () => {
        await microClient?.close()
        await testContext?.close()
    }

    return { closeFixture, microClient, httpClient }
}
