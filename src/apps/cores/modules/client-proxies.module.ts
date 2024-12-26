import { Module } from '@nestjs/common'
import { Transport } from '@nestjs/microservices'
import { ClientProxyModule } from 'common'
import { AppConfigService } from 'shared/config'

@Module({
    imports: [
        ClientProxyModule.registerAsync({
            name: 'INFRASTRUCTURES_CLIENT',
            useFactory: async (config: AppConfigService) => ({
                transport: Transport.TCP,
                options: config.services.infrastructures
            }),
            inject: [AppConfigService]
        })
    ]
})
export class ClientProxiesModule {}
