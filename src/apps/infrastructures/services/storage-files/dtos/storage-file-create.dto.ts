import { IsInt, IsNotEmpty, IsString } from 'class-validator'
import { BaseDto } from 'common'

export class StorageFileCreateDto extends BaseDto {
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
