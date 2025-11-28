import { Controller } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { Messages } from 'shared'
import { CompleteAttachmentDto, GetUploadUrlDto } from './dtos'
import { AttachmentsService } from './attachments.service'

@Controller()
export class AttachmentsController {
    constructor(private service: AttachmentsService) {}

    @MessagePattern(Messages.Attachments.getMany)
    getMany(@Payload() fileIds: string[]) {
        return this.service.getMany(fileIds)
    }

    @MessagePattern(Messages.Attachments.deleteMany)
    deleteMany(@Payload() fileIds: string[]) {
        return this.service.deleteMany(fileIds)
    }

    @MessagePattern(Messages.Attachments.getUploadUrl)
    getUploadUrl(@Payload() dto: GetUploadUrlDto) {
        return this.service.getUploadUrl(dto)
    }

    @MessagePattern(Messages.Attachments.complete)
    complete(@Payload() dto: CompleteAttachmentDto) {
        return this.service.complete(dto)
    }
}
