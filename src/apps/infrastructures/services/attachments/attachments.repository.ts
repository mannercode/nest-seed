import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { MongooseRepository } from 'common'
import { ClientSession, Model } from 'mongoose'
import { MongooseConfigModule } from 'shared'
import { CreateAttachmentDto } from './dtos'
import { Attachment } from './models'

export type AttachmentCreateInput = Pick<
    CreateAttachmentDto,
    'originalName' | 'mimeType' | 'size'
> & { ownerService?: string | null; ownerEntityId?: string | null }

@Injectable()
export class AttachmentsRepository extends MongooseRepository<Attachment> {
    constructor(
        @InjectModel(Attachment.name, MongooseConfigModule.connectionName)
        model: Model<Attachment>
    ) {
        super(model, MongooseConfigModule.maxTake)
    }

    async createAttachment(
        createDto: AttachmentCreateInput,
        checksum: string,
        session?: ClientSession
    ) {
        const attachment = this.newDocument()
        attachment.originalName = createDto.originalName
        attachment.mimeType = createDto.mimeType
        attachment.size = createDto.size
        attachment.checksum = checksum
        attachment.ownerService = createDto.ownerService ?? null
        attachment.ownerEntityId = createDto.ownerEntityId ?? null

        return attachment.save({ session })
    }
}
