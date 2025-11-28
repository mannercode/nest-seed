import { Body, Controller, Post } from '@nestjs/common'
import { AttachmentsClient, CreateAttachmentDto } from 'apps/infrastructures'
import { HttpRoutes } from 'shared'

@Controller(HttpRoutes.Attachments)
export class AttachmentsController {
    constructor(private attachmentsService: AttachmentsClient) {}

    @Post()
    create(@Body() body: CreateAttachmentDto) {
        return this.attachmentsService.create(body)
    }
}
