import { Module } from '@nestjs/common'
import { Transport } from '@nestjs/microservices'
import { ClientProxyModule } from 'common'
import { AppConfigService } from 'shared/config'

// TODO name을 설정해야 한다.
@Module({
    imports: [
        ClientProxyModule.registerAsync({
            name: 'clientProxy',
            useFactory: async (config: AppConfigService) => {
                const { servers } = config.nats
                return { transport: Transport.NATS, options: { servers, queue: 'applications' } }
            },
            inject: [AppConfigService]
        })
    ]
})
export class ClientProxiesModule {}
