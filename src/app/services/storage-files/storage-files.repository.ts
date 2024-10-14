import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { MethodLog, MongooseRepository, SchemeBody } from 'common'
import { ClientSession, Model } from 'mongoose'
import { StorageFile } from './schemas'

@Injectable()
export class StorageFilesRepository extends MongooseRepository<StorageFile> {
    constructor(@InjectModel(StorageFile.name) model: Model<StorageFile>) {
        super(model)
    }

    async onModuleInit() {
        await this.model.createCollection()
    }

    @MethodLog({ excludeArgs: ['session'] })
    async createStorageFile(creationDto: SchemeBody<StorageFile>, session?: ClientSession) {
        const storageFile = this.newDocument()
        storageFile.originalname = creationDto.originalname
        storageFile.mimetype = creationDto.mimetype
        storageFile.size = creationDto.size
        storageFile.checksum = creationDto.checksum

        return storageFile.save({ session })
    }

    @MethodLog()
    async deleteStorageFile(fileId: string) {
        const file = await this.getStorageFile(fileId)
        await file.deleteOne()
    }

    @MethodLog({ level: 'verbose' })
    async getStorageFile(fileId: string) {
        const file = await this.findById(fileId)

        if (!file) throw new NotFoundException(`StorageFile with ID ${fileId} not found`)

        return file
    }
}
