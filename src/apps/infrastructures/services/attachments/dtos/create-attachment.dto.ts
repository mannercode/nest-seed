import { IsInt, IsNotEmpty, IsString } from 'class-validator'

export class CreateAttachmentDto {
    @IsString()
    @IsNotEmpty()
    originalName: string

    @IsString()
    @IsNotEmpty()
    mimeType: string

    @IsInt()
    size: number

    @IsString()
    @IsNotEmpty()
    path: string
}
