import { Module } from '@nestjs/common'
import { ConfigModule } from './config.module'
import { EventModule } from './event.module'
import { HttpModule } from './http.module'
import { LoggerModule } from './logger.module'
import { MongoDbModule } from './mongo.db.module'
import { MulterModule } from './multer.module'

@Module({
    imports: [
        ConfigModule,
        EventModule,
        HttpModule,
        LoggerModule,
        MongoDbModule,
        MulterModule
    ],
    exports: [MulterModule]
})
export class CoreModule {}
