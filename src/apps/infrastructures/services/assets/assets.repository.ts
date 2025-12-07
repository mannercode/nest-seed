import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { MongooseRepository } from 'common'
import { Model } from 'mongoose'
import { MongooseConfigModule } from 'shared'
import { CreateAssetDto } from './dtos'
import { Asset, AssetDocument } from './models'

@Injectable()
export class AssetsRepository extends MongooseRepository<Asset> {
    constructor(
        @InjectModel(Asset.name, MongooseConfigModule.connectionName)
        readonly model: Model<Asset>
    ) {
        super(model, MongooseConfigModule.maxTake)
    }

    async createAsset(createDto: CreateAssetDto) {
        const asset = this.newDocument()
        asset.originalName = createDto.originalName
        asset.mimeType = createDto.mimeType
        asset.size = createDto.size
        asset.checksum = createDto.checksum

        return asset.save()
    }

    async findExpiredUncompleted(expireBefore: Date): Promise<AssetDocument[]> {
        return this.model.find({
            ownerService: null,
            ownerEntityId: null,
            createdAt: { $lte: expireBefore }
        })
    }
}
