import { IsNotEmpty, IsString } from 'class-validator'

export class CompleteAttachmentDto {
    @IsString()
    @IsNotEmpty()
    ownerService: string

    @IsString()
    @IsNotEmpty()
    ownerEntityId: string
}
