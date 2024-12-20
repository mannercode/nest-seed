import { Module } from '@nestjs/common'
import { Transport } from '@nestjs/microservices'
import { ClientProxyModule } from 'common'
import { CoresConfigService } from '../config'

@Module({
    imports: [
        ClientProxyModule.registerAsync({
            name: 'INFRASTRUCTURES_CLIENT',
            useFactory: async (config: CoresConfigService) => ({
                transport: Transport.TCP,
                options: { host: '0.0.0.0', port: config.clients.infrastructures.port }
            }),
            inject: [CoresConfigService]
        })
    ]
})
export class ClientProxiesModule {}
