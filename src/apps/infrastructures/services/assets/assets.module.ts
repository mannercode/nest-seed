import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { S3ObjectModule } from 'common'
import { AppConfigService, MongooseConfigModule } from 'shared'
import { Asset, AssetSchema } from './models'
import { AssetsController } from './assets.controller'
import { AssetsRepository } from './assets.repository'
import { AssetsService } from './assets.service'

@Module({
    imports: [
        MongooseModule.forFeature(
            [{ name: Asset.name, schema: AssetSchema }],
            MongooseConfigModule.connectionName
        ),
        S3ObjectModule.register({
            useFactory: (config: AppConfigService) => config.s3,
            inject: [AppConfigService]
        })
    ],
    providers: [AssetsService, AssetsRepository],
    controllers: [AssetsController]
})
export class AssetsModule {}
