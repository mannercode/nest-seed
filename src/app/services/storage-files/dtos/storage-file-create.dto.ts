import { IsInt, IsNotEmpty, IsString } from 'class-validator'

export class StorageFileCreateDto {
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
    path: string
}
