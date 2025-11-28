import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { MongooseRepository } from 'common'
import { Model } from 'mongoose'
import { MongooseConfigModule } from 'shared'
import { CreateAttachmentDto } from './dtos'
import { Attachment } from './models'

export type AttachmentCreateInput = {
    originalName: string
    mimeType: string
    size: number
    ownerService?: string | null
    ownerEntityId?: string | null
}

@Injectable()
export class AttachmentsRepository extends MongooseRepository<Attachment> {
    constructor(
        @InjectModel(Attachment.name, MongooseConfigModule.connectionName)
        model: Model<Attachment>
    ) {
        super(model, MongooseConfigModule.maxTake)
    }

    async createAttachment(createDto: CreateAttachmentDto) {
        const attachment = this.newDocument()
        attachment.originalName = createDto.originalName
        attachment.mimeType = createDto.mimeType
        attachment.size = createDto.size
        attachment.checksum = createDto.checksum

        return attachment.save()
    }
}
