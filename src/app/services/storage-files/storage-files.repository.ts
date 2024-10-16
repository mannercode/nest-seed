import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { MethodLog, ModelAttributes, MongooseRepository, ObjectId } from 'common'
import { ClientSession, Model } from 'mongoose'
import { StorageFile } from './models'

@Injectable()
export class StorageFilesRepository extends MongooseRepository<StorageFile> {
    constructor(@InjectModel(StorageFile.name) model: Model<StorageFile>) {
        super(model)
    }

    async onModuleInit() {
        await this.model.createCollection()
    }

    @MethodLog({ excludeArgs: ['session'] })
    async createStorageFile(creationDto: ModelAttributes<StorageFile>, session?: ClientSession) {
        const storageFile = this.newDocument()
        Object.assign(storageFile, creationDto)

        return storageFile.save({ session })
    }

    @MethodLog()
    async deleteStorageFile(fileId: ObjectId) {
        const file = await this.getStorageFile(fileId)
        await file.deleteOne()
    }

    @MethodLog({ level: 'verbose' })
    async getStorageFile(fileId: ObjectId) {
        const file = await this.findById(fileId)

        if (!file) throw new NotFoundException(`StorageFile with ID ${fileId} not found`)

        return file
    }
}
