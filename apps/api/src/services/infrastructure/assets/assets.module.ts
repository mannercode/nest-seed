import { CacheModule, S3ObjectModule } from '@mannercode/common'
import { Module } from '@nestjs/common'
import { AppConfigService, REDIS_CONNECTION_NAME } from '#config'
import { AssetsRepository } from './assets.repository.js'
import { AssetsService } from './assets.service.js'

@Module({
    exports: [AssetsService],
    imports: [
        S3ObjectModule.register({
            inject: [AppConfigService],
            useFactory: (config: AppConfigService) => config.s3
        }),
        CacheModule.register({
            inject: [AppConfigService],
            name: 'assets',
            prefix: (config: AppConfigService) => `cache:${config.projectId}`,
            redisName: REDIS_CONNECTION_NAME
        })
    ],
    providers: [AssetsService, AssetsRepository]
})
export class AssetsModule {}
