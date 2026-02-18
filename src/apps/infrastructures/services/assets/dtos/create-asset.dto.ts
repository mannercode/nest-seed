import { Type } from 'class-transformer'
import { IsInt, IsNotEmpty, IsString, Min, ValidateNested } from 'class-validator'
import { Checksum } from 'common'

export class CreateAssetDto {
    @IsNotEmpty()
    @Type(() => Checksum)
    @ValidateNested()
    checksum: Checksum

    @IsNotEmpty()
    @IsString()
    mimeType: string

    @IsNotEmpty()
    @IsString()
    originalName: string

    @IsInt()
    @Min(1)
    size: number
}
