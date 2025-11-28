import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common'
import { AttachmentsClient, GetUploadUrlDto } from 'apps/infrastructures'
import { IsNotEmpty, IsString } from 'class-validator'
import { HttpRoutes } from 'shared'

class CompleteAttachmentBodyDto {
    @IsString()
    @IsNotEmpty()
    ownerService: string

    @IsString()
    @IsNotEmpty()
    ownerEntityId: string
}

@Controller(HttpRoutes.Attachments)
export class AttachmentsController {
    constructor(private attachmentsService: AttachmentsClient) {}

    @Post()
    getUploadUrl(@Body() body: GetUploadUrlDto) {
        return this.attachmentsService.getUploadUrl(body)
    }

    @Get(':attachmentId')
    async getDownloadInfo(@Param('attachmentId') attachmentId: string) {
        const [attachment] = await this.attachmentsService.getMany([attachmentId])
        return attachment
    }

    @Post(':attachmentId/complete')
    @HttpCode(HttpStatus.OK)
    complete(@Param('attachmentId') attachmentId: string, @Body() body: CompleteAttachmentBodyDto) {
        return this.attachmentsService.complete(attachmentId, body)
    }

    @Delete(':attachmentId')
    async deleteFile(@Param('attachmentId') attachmentId: string) {
        return this.attachmentsService.deleteMany([attachmentId])
    }
}
