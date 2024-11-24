import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { MethodLog, MongooseRepository } from 'common'
import { ClientSession, Model } from 'mongoose'
import { StorageFile, StorageFileCreatePayload } from './models'

@Injectable()
export class StorageFilesRepository extends MongooseRepository<StorageFile> {
    constructor(@InjectModel(StorageFile.name) model: Model<StorageFile>) {
        super(model)
    }

    @MethodLog({ excludeArgs: ['session'] })
    async createStorageFile(createDto: StorageFileCreatePayload, session?: ClientSession) {
        const storageFile = this.newDocument()
        Object.assign(storageFile, createDto)

        return storageFile.save({ session })
    }
}
