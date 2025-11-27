import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { S3ObjectModule } from 'common'
import { AppConfigService, MongooseConfigModule } from 'shared'
import { StorageFile, StorageFileSchema } from './models'
import { StorageFilesController } from './storage-files.controller'
import { StorageFilesRepository } from './storage-files.repository'
import { StorageFilesService } from './storage-files.service'

@Module({
    imports: [
        MongooseModule.forFeature(
            [{ name: StorageFile.name, schema: StorageFileSchema }],
            MongooseConfigModule.connectionName
        ),
        S3ObjectModule.register({
            useFactory: (config: AppConfigService) => config.amazonS3,
            inject: [AppConfigService]
        })
    ],
    providers: [StorageFilesService, StorageFilesRepository],
    controllers: [StorageFilesController]
})
export class StorageFilesModule {}
