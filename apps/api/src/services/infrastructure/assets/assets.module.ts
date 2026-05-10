import { CacheModule, S3ObjectModule } from '@mannercode/common'
import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { AppConfigService, getProjectId } from 'config'
import { MongooseSetupModule, RedisSetupModule } from 'modules'
import { AssetsRepository } from './assets.repository'
import { AssetsService } from './assets.service'
import { Asset, AssetSchema } from './models'

@Module({
    exports: [AssetsService],
    imports: [
        MongooseModule.forFeature(
            [{ name: Asset.name, schema: AssetSchema }],
            MongooseSetupModule.connectionName
        ),
        S3ObjectModule.register({
            inject: [AppConfigService],
            useFactory: (config: AppConfigService) => config.s3
        }),
        CacheModule.register({
            name: 'assets',
            prefix: `cache:${getProjectId()}`,
            redisName: RedisSetupModule.connectionName
        })
    ],
    providers: [AssetsService, AssetsRepository]
})
export class AssetsModule {}
