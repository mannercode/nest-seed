import { Module } from '@nestjs/common'
import { Transport } from '@nestjs/microservices'
import { ClientProxyModule } from 'common'
import { GatewayConfigService } from '../config'

@Module({
    imports: [
        ClientProxyModule.registerAsync({
            name: 'APPLICATIONS_CLIENT',
            useFactory: async (config: GatewayConfigService) => ({
                transport: Transport.TCP,
                options: { host: '0.0.0.0', port: config.clients.applications.port }
            }),
            inject: [GatewayConfigService]
        }),
        ClientProxyModule.registerAsync({
            name: 'CORES_CLIENT',
            useFactory: async (config: GatewayConfigService) => ({
                transport: Transport.TCP,
                options: { host: '0.0.0.0', port: config.clients.cores.port }
            }),
            inject: [GatewayConfigService]
        }),
        ClientProxyModule.registerAsync({
            name: 'INFRASTRUCTURES_CLIENT',
            useFactory: async (config: GatewayConfigService) => ({
                transport: Transport.TCP,
                options: { host: '0.0.0.0', port: config.clients.infrastructures.port }
            }),
            inject: [GatewayConfigService]
        })
    ]
})
export class ClientProxiesModule {}
