import { Module } from '@nestjs/common'
import { Transport } from '@nestjs/microservices'
import { ClientProxyModule, generateShortId } from 'common'
import { AppConfigService, isTest } from 'shared/config'

@Module({
    imports: [
        ClientProxyModule.registerAsync({
            name: 'clientProxy',
            tag: () => (isTest() ? 'test_' + generateShortId() : 'gateway'),
            useFactory: async (config: AppConfigService) => {
                const { servers } = config.nats
                return { transport: Transport.NATS, options: { servers } }
            },
            inject: [AppConfigService]
        })
    ]
})
export class ClientProxiesModule {}
