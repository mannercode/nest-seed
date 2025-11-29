import { Injectable } from '@nestjs/common'
import { ClientProxyService, InjectClientProxy } from 'common'
import { Messages } from 'shared'
import {
    AttachmentDto,
    CompleteAttachmentDto,
    DeleteAttachmentsResponse,
    CreateAttachmentDto,
    CreateAttachmentResponse
} from './dtos'

@Injectable()
export class AttachmentsClient {
    constructor(@InjectClientProxy() private proxy: ClientProxyService) {}

    create(dto: CreateAttachmentDto): Promise<CreateAttachmentResponse> {
        return this.proxy.getJson(Messages.Attachments.create, dto)
    }

    complete(attachmentId: string, completeDto: CompleteAttachmentDto): Promise<AttachmentDto> {
        return this.proxy.getJson(Messages.Attachments.complete, { attachmentId, completeDto })
    }

    getMany(attachmentIds: string[]): Promise<AttachmentDto[]> {
        return this.proxy.getJson(Messages.Attachments.getMany, attachmentIds)
    }

    deleteMany(attachmentIds: string[]): Promise<DeleteAttachmentsResponse> {
        return this.proxy.getJson(Messages.Attachments.deleteMany, attachmentIds)
    }
}
