import { Module } from '@nestjs/common'
import { ClientProxyModule } from 'common'
import { ConfigModule } from './config.module'
import { HttpModule } from './http.module'
import { LoggerModule } from './logger.module'
import { MulterModule } from './multer.module'
import { Transport } from '@nestjs/microservices'
import { AppConfigService } from 'config'

@Module({
    imports: [
        ConfigModule,
        HttpModule,
        LoggerModule,
        MulterModule,
        ClientProxyModule.registerAsync({
            name: 'SERVICES_CLIENT',
            useFactory: async (config: AppConfigService) => ({
                transport: Transport.TCP,
                options: { host: '0.0.0.0', port: config.service.port }
            }),
            inject: [AppConfigService]
        })
    ],
    exports: [MulterModule]
})
export class CoreModule {}
