import { Injectable } from '@nestjs/common'
import { ClientProxyService, InjectClientProxy } from 'common'
import { Messages } from 'shared'
import {
    AttachmentDto,
    CompleteAttachmentDto,
    CreateAttachmentDto,
    DeleteAttachmentsResponse,
    PresignDownloadUrlResponse,
    PresignUploadUrlDto,
    PresignUploadUrlResponse
} from './dtos'

@Injectable()
export class AttachmentsClient {
    constructor(@InjectClientProxy() private proxy: ClientProxyService) {}

    saveFiles(createDtos: CreateAttachmentDto[]): Promise<AttachmentDto[]> {
        return this.proxy.getJson(Messages.Attachments.saveFiles, createDtos)
    }

    getFiles(fileIds: string[]): Promise<AttachmentDto[]> {
        return this.proxy.getJson(Messages.Attachments.getFiles, fileIds)
    }

    deleteFiles(fileIds: string[]): Promise<DeleteAttachmentsResponse> {
        return this.proxy.getJson(Messages.Attachments.deleteFiles, fileIds)
    }

    presignUploadUrl(dto: PresignUploadUrlDto): Promise<PresignUploadUrlResponse> {
        return this.proxy.getJson(Messages.Attachments.presignUploadUrl, dto)
    }

    presignDownloadUrl(
        attachmentId: string,
        expiresInSec?: number
    ): Promise<PresignDownloadUrlResponse> {
        return this.proxy.getJson(Messages.Attachments.presignDownloadUrl, {
            attachmentId,
            expiresInSec
        })
    }

    complete(
        attachmentId: string,
        ownerInfo: Omit<CompleteAttachmentDto, 'attachmentId'>
    ): Promise<AttachmentDto> {
        return this.proxy.getJson(Messages.Attachments.complete, { attachmentId, ...ownerInfo })
    }
}
