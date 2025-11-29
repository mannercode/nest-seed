import { IsNotEmpty, IsString } from 'class-validator'

export class CompleteAssetDto {
    @IsString()
    @IsNotEmpty()
    ownerService: string

    @IsString()
    @IsNotEmpty()
    ownerEntityId: string
}
