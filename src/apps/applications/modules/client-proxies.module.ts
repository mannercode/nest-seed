import { Module } from '@nestjs/common'
import { APP_PIPE } from '@nestjs/core'
import { Transport } from '@nestjs/microservices'
import { AppValidationPipe, ClientProxyModule } from 'common'
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
    ],
    providers: [{ provide: APP_PIPE, useClass: AppValidationPipe }]
})
export class ClientProxiesModule {}
