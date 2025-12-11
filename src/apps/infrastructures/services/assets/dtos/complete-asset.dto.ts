import { Type } from 'class-transformer'
import { IsDefined, ValidateNested } from 'class-validator'
import { AssetOwnerDto } from './asset.dto'

export class CompleteAssetDto {
    @IsDefined()
    @ValidateNested()
    @Type(() => AssetOwnerDto)
    owner: AssetOwnerDto
}
