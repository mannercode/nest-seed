import { Controller } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { Messages } from 'shared'
import { CompleteAttachmentDto, CreateAttachmentDto } from './dtos'
import { AttachmentsService } from './attachments.service'

@Controller()
export class AttachmentsController {
    constructor(private service: AttachmentsService) {}

    @MessagePattern(Messages.Attachments.create)
    create(@Payload() dto: CreateAttachmentDto) {
        return this.service.create(dto)
    }

    @MessagePattern(Messages.Attachments.complete)
    complete(
        @Payload('attachmentId') attachmentId: string,
        @Payload('completeDto') completeDto: CompleteAttachmentDto
    ) {
        return this.service.complete(attachmentId, completeDto)
    }

    @MessagePattern(Messages.Attachments.getMany)
    getMany(@Payload() attachmentIds: string[]) {
        return this.service.getMany(attachmentIds)
    }

    @MessagePattern(Messages.Attachments.deleteMany)
    deleteMany(@Payload() attachmentIds: string[]) {
        return this.service.deleteMany(attachmentIds)
    }
}
