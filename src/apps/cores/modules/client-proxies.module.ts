import { Module } from '@nestjs/common'
import { Transport } from '@nestjs/microservices'
import { ClientProxyModule } from 'common'
import { AppConfigService } from 'shared/config'

@Module({
    imports: [
        ClientProxyModule.registerAsync({
            name: 'clientProxy',
            useFactory: async (config: AppConfigService) => {
                const { servers } = config.nats
                return { transport: Transport.NATS, options: { servers } }
            },
            inject: [AppConfigService]
        })
    ]
})
export class ClientProxiesModule {}
