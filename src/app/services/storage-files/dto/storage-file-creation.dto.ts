import { IsInt, IsNotEmpty, IsString } from 'class-validator'

export class StorageFileCreationDto {
    @IsString()
    @IsNotEmpty()
    originalname: string

    @IsString()
    @IsNotEmpty()
    mimetype: string

    @IsInt()
    size: number

    @IsString()
    @IsNotEmpty()
    uploadedFilePath: string
}