import { IsNotEmpty, IsString } from 'class-validator'

export class CompleteAttachmentDto {
    @IsString()
    @IsNotEmpty()
    attachmentId: string

    @IsString()
    @IsNotEmpty()
    ownerService: string

    @IsString()
    @IsNotEmpty()
    ownerEntityId: string
}
