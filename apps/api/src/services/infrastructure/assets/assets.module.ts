import { CacheModule, S3ObjectModule } from '@mannercode/common'
import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import {
    AppConfigService,
    getProjectId,
    MONGO_CONNECTION_NAME,
    REDIS_CONNECTION_NAME
} from 'config'
import { AssetsRepository } from './assets.repository'
import { AssetsService } from './assets.service'
import { Asset, AssetSchema } from './models'

@Module({
    exports: [AssetsService],
    imports: [
        MongooseModule.forFeature(
            [{ name: Asset.name, schema: AssetSchema }],
            MONGO_CONNECTION_NAME
        ),
        S3ObjectModule.register({
            inject: [AppConfigService],
            useFactory: (config: AppConfigService) => config.s3
        }),
        CacheModule.register({
            name: 'assets',
            prefix: `cache:${getProjectId()}`,
            redisName: REDIS_CONNECTION_NAME
        })
    ],
    providers: [AssetsService, AssetsRepository]
})
export class AssetsModule {}
