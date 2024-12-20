import { Module } from '@nestjs/common'
import { Transport } from '@nestjs/microservices'
import { ClientProxyModule } from 'common'
import { ApplicationsConfigService } from '../config'

@Module({
    imports: [
        ClientProxyModule.registerAsync({
            name: 'CORES_CLIENT',
            useFactory: async (config: ApplicationsConfigService) => ({
                transport: Transport.TCP,
                options: { host: '0.0.0.0', port: config.clients.cores.port }
            }),
            inject: [ApplicationsConfigService]
        }),
        ClientProxyModule.registerAsync({
            name: 'INFRASTRUCTURES_CLIENT',
            useFactory: async (config: ApplicationsConfigService) => ({
                transport: Transport.TCP,
                options: { host: '0.0.0.0', port: config.clients.infrastructures.port }
            }),
            inject: [ApplicationsConfigService]
        })
    ]
})
export class ClientProxiesModule {}
