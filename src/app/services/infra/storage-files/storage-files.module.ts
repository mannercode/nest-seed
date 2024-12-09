import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { MongooseConfig } from 'config'
import { StorageFile, StorageFileSchema } from './models'
import { StorageFilesRepository } from './storage-files.repository'
import { StorageFilesService } from './storage-files.service'

@Module({
    imports: [
        MongooseModule.forFeature(
            [{ name: StorageFile.name, schema: StorageFileSchema }],
            MongooseConfig.connName
        )
    ],
    providers: [StorageFilesService, StorageFilesRepository],
    exports: [StorageFilesService]
})
export class StorageFilesModule {}
