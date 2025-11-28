import { Injectable } from '@nestjs/common'
import { ClientProxyService, InjectClientProxy } from 'common'
import { Messages } from 'shared'
import {
    AttachmentDto,
    CompleteAttachmentDto,
    DeleteAttachmentsResponse,
    GetUploadUrlDto,
    GetUploadUrlResponse
} from './dtos'

@Injectable()
export class AttachmentsClient {
    constructor(@InjectClientProxy() private proxy: ClientProxyService) {}

    getMany(fileIds: string[]): Promise<AttachmentDto[]> {
        return this.proxy.getJson(Messages.Attachments.getMany, fileIds)
    }

    deleteMany(fileIds: string[]): Promise<DeleteAttachmentsResponse> {
        return this.proxy.getJson(Messages.Attachments.deleteMany, fileIds)
    }

    getUploadUrl(dto: GetUploadUrlDto): Promise<GetUploadUrlResponse> {
        return this.proxy.getJson(Messages.Attachments.getUploadUrl, dto)
    }

    complete(
        attachmentId: string,
        ownerInfo: Omit<CompleteAttachmentDto, 'attachmentId'>
    ): Promise<AttachmentDto> {
        return this.proxy.getJson(Messages.Attachments.complete, { attachmentId, ...ownerInfo })
    }
}
