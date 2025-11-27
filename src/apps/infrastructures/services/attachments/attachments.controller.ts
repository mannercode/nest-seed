import { Controller, ParseArrayPipe } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { Messages } from 'shared'
import {
    CompleteAttachmentDto,
    CreateAttachmentDto,
    PresignDownloadUrlDto,
    PresignUploadUrlDto
} from './dtos'
import { AttachmentsService } from './attachments.service'

@Controller()
export class AttachmentsController {
    constructor(private service: AttachmentsService) {}

    @MessagePattern(Messages.Attachments.saveFiles)
    saveFiles(
        @Payload(new ParseArrayPipe({ items: CreateAttachmentDto }))
        createDtos: CreateAttachmentDto[]
    ) {
        return this.service.saveFiles(createDtos)
    }

    @MessagePattern(Messages.Attachments.getFiles)
    getFiles(@Payload() fileIds: string[]) {
        return this.service.getFiles(fileIds)
    }

    @MessagePattern(Messages.Attachments.deleteFiles)
    deleteFiles(@Payload() fileIds: string[]) {
        return this.service.deleteFiles(fileIds)
    }

    @MessagePattern(Messages.Attachments.presignUploadUrl)
    presignUploadUrl(@Payload() dto: PresignUploadUrlDto) {
        return this.service.presignUploadUrl(dto)
    }

    @MessagePattern(Messages.Attachments.presignDownloadUrl)
    presignDownloadUrl(@Payload() dto: PresignDownloadUrlDto) {
        return this.service.presignDownloadUrl(dto)
    }

    @MessagePattern(Messages.Attachments.complete)
    complete(@Payload() dto: CompleteAttachmentDto) {
        return this.service.complete(dto)
    }
}
