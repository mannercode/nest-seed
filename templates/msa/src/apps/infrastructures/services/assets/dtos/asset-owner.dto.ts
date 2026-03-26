import { IsNotEmpty, IsString } from 'class-validator'

export class AssetOwnerDto {
    @IsNotEmpty()
    @IsString()
    entityId: string

    @IsNotEmpty()
    @IsString()
    service: string
}
