import { Module } from '@nestjs/common'
import { ConfigModule } from './config.module'
import { LoggerModule } from './logger.module'
import { MulterModule } from './multer.module'
import { PipesModule } from './pipes.module'
import { ClientProxyModule } from './client-proxy.module'

@Module({
    imports: [ConfigModule, PipesModule, LoggerModule, MulterModule, ClientProxyModule],
    exports: [MulterModule]
})
export class Modules {}
