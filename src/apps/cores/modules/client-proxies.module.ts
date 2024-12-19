import { Module } from '@nestjs/common'
import { APP_PIPE } from '@nestjs/core'
import { Transport } from '@nestjs/microservices'
import { AppValidationPipe, ClientProxyModule } from 'common'
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
    ],
    providers: [{ provide: APP_PIPE, useClass: AppValidationPipe }]
})
export class ClientProxiesModule {}
