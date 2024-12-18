import { Module } from '@nestjs/common'
import { Transport } from '@nestjs/microservices'
import { ClientProxyModule as OrgClientProxyModule } from 'common'
import { AppConfigService } from 'config'

@Module({
    imports: [
        OrgClientProxyModule.registerAsync({
            name: 'SERVICES_CLIENT',
            useFactory: async (config: AppConfigService) => ({
                transport: Transport.TCP,
                options: { host: '0.0.0.0', port: config.service.port }
            }),
            inject: [AppConfigService]
        })
    ]
})
export class ClientProxyModule {}
