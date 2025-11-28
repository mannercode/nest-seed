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

    getMany(fileIds: string[]): Promise<AttachmentDto[]> {
        return this.proxy.getJson(Messages.Attachments.getMany, fileIds)
    }

    deleteMany(fileIds: string[]): Promise<DeleteAttachmentsResponse> {
        return this.proxy.getJson(Messages.Attachments.deleteMany, fileIds)
    }

    complete(
        attachmentId: string,
        ownerInfo: Omit<CompleteAttachmentDto, 'attachmentId'>
    ): Promise<AttachmentDto> {
        return this.proxy.getJson(Messages.Attachments.complete, { attachmentId, ...ownerInfo })
    }
}
