import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { MethodLog, MongooseRepository } from 'common'
import { MongooseConfig } from 'config'
import { ClientSession, Model } from 'mongoose'
import { StorageFileCreateDto } from './dtos'
import { StorageFile } from './models'

@Injectable()
export class StorageFilesRepository extends MongooseRepository<StorageFile> {
    constructor(@InjectModel(StorageFile.name, MongooseConfig.connName) model: Model<StorageFile>) {
        super(model)
    }

    @MethodLog({ excludeArgs: ['session'] })
    async createStorageFile(
        createDto: StorageFileCreateDto,
        checksum: string,
        session?: ClientSession
    ) {
        const storageFile = this.newDocument()
        storageFile.originalname = createDto.originalname
        storageFile.mimetype = createDto.mimetype
        storageFile.size = createDto.size
        storageFile.checksum = checksum

        return storageFile.save({ session })
    }
}
