import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { MongooseRepository } from 'common'
import { ClientSession, Model } from 'mongoose'
import { MongooseConfig } from 'shared/config'
import { StorageFileCreateDto } from './dtos'
import { StorageFile } from './models'

@Injectable()
export class StorageFilesRepository extends MongooseRepository<StorageFile> {
    constructor(@InjectModel(StorageFile.name, MongooseConfig.connName) model: Model<StorageFile>) {
        super(model)
    }

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
