import { IsDefined, ValidateNested } from 'class-validator'
import { AssetOwnerDto } from './asset-owner.dto'

export class FinalizeAssetDto {
    @IsDefined()
    @ValidateNested()
    owner: AssetOwnerDto
}
