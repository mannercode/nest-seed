import { S3ObjectModule } from '@mannercode/common'
import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { AppConfigService, MongooseConfigModule } from 'common'
import { AssetsRepository } from './assets.repository'
import { AssetsService } from './assets.service'
import { Asset, AssetSchema } from './models'

@Module({
    exports: [AssetsService],
    imports: [
        MongooseModule.forFeature(
            [{ name: Asset.name, schema: AssetSchema }],
            MongooseConfigModule.connectionName
        ),
        S3ObjectModule.register({
            inject: [AppConfigService],
            useFactory: (config: AppConfigService) => config.s3
        })
    ],
    providers: [AssetsService, AssetsRepository]
})
export class AssetsModule {}
