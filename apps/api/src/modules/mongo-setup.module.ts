import { Module } from '@nestjs/common'
import { MongoModule } from '@mannercode/common'
import { AppConfigService } from '#config'

@Module({
    imports: [
        MongoModule.forRootAsync({
            inject: [AppConfigService],
            useFactory: (config: AppConfigService) => ({ ...config.mongo, lifetime: 'application' })
        })
    ]
})
export class MongoSetupModule {}
