import { Module } from '@nestjs/common'
import { Transport } from '@nestjs/microservices'
import { ClientProxyModule } from 'common'
import { AppConfigService } from 'shared/config'

@Module({
    imports: [
        ClientProxyModule.registerAsync({
            name: 'APPLICATIONS_CLIENT',
            useFactory: async (config: AppConfigService) => ({
                transport: Transport.TCP,
                options: config.services.applications
            }),
            inject: [AppConfigService]
        }),
        ClientProxyModule.registerAsync({
            name: 'CORES_CLIENT',
            useFactory: async (config: AppConfigService) => ({
                transport: Transport.TCP,
                options: config.services.cores
            }),
            inject: [AppConfigService]
        }),
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
