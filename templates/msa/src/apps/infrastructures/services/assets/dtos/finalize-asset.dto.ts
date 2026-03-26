import { Type } from 'class-transformer'
import { IsDefined, ValidateNested } from 'class-validator'
import { AssetOwnerDto } from './asset-owner.dto'

export class FinalizeAssetDto {
    @IsDefined()
    @Type(() => AssetOwnerDto)
    @ValidateNested()
    owner: AssetOwnerDto
}
