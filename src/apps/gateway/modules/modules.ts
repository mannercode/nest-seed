import { Module } from '@nestjs/common'
import { ClientProxiesModule } from './client-proxies.module'
import { ConfigModule } from './config.module'
import { HealthModule } from './health.module'
import { LoggerModule } from './logger.module'
import { MulterModule } from './multer.module'
import { PipesModule } from './pipes.module'

@Module({
    imports: [
        HealthModule,
        ConfigModule,
        PipesModule,
        LoggerModule,
        MulterModule,
        ClientProxiesModule
    ],
    exports: [MulterModule]
})
export class Modules {}
