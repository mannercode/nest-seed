import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { StorageFile, StorageFileSchema } from './schemas'
import { StorageFilesRepository } from './storage-files.repository'
import { StorageFilesService } from './storage-files.service'

@Module({
    imports: [MongooseModule.forFeature([{ name: StorageFile.name, schema: StorageFileSchema }])],
    providers: [StorageFilesService, StorageFilesRepository],
    exports: [StorageFilesService]
})
export class StorageFilesModule {}
