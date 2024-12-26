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
                options: { host: '127.0.0.1', port: config.clients.infrastructures.port }
            }),
            inject: [AppConfigService]
        })
    ]
})
export class ClientProxiesModule {}
