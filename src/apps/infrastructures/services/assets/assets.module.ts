import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { S3ObjectModule } from 'common'
import { AppConfigService, MongooseConfigModule } from 'shared'
import { AssetsController } from './assets.controller'
import { AssetsRepository } from './assets.repository'
import { AssetsService } from './assets.service'
import { Asset, AssetSchema } from './models'

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
    controllers: [AssetsController],
    exports: [AssetsService]
})
export class AssetsModule {}
