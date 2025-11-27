import { IsNotEmpty, IsString } from 'class-validator'

export class CompleteStorageFileDto {
    @IsString()
    @IsNotEmpty()
    storageFileId: string

    @IsString()
    @IsNotEmpty()
    ownerService: string

    @IsString()
    @IsNotEmpty()
    ownerEntityId: string
}
