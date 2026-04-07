import { createTestContext } from '@mannercode/testing'
import { getTemporalTestConnection } from '@mannercode/testing-microservices'
import { Injectable } from '@nestjs/common'
import { Client } from '@temporalio/client'
import {
    InjectTemporalClient,
    TemporalClientModule,
    TEMPORAL_CLIENT
} from '../temporal-client.module'

export type TemporalClientModuleFixture = { client: Client; teardown: () => Promise<void> }

@Injectable()
class TestTemporalConsumer {
    constructor(@InjectTemporalClient() readonly client: Client) {}
}

export async function createTemporalClientModuleFixture() {
    const { close, module } = await createTestContext({
        imports: [
            TemporalClientModule.registerAsync({
                useFactory: () => ({ address: getTemporalTestConnection(), namespace: 'default' })
            })
        ],
        providers: [TestTemporalConsumer]
    })

    const client = module.get<Client>(TEMPORAL_CLIENT)

    const teardown = async () => {
        await close()
    }

    return { client, teardown }
}
