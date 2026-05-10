import { CrudRepository, leanArrayToPublic } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { MongooseSetupModule } from 'modules'
import { Model } from 'mongoose'
import { CreateAssetDto } from './dtos'
import { Asset } from './models'

@Injectable()
export class AssetsRepository extends CrudRepository<Asset> {
    constructor(
        @InjectModel(Asset.name, MongooseSetupModule.connectionName)
        readonly model: Model<Asset>
    ) {
        super(model, MongooseSetupModule.maxTake)
    }

    async assignOwner(assetId: string, owner: { entityId: string; service: string }) {
        const asset = await this.getDocumentById(assetId)
        asset.ownerService = owner.service
        asset.ownerEntityId = owner.entityId

        await asset.save()

        return asset.toJSON()
    }

    async create(createDto: CreateAssetDto) {
        const asset = this.newDocument()
        asset.originalName = createDto.originalName
        asset.mimeType = createDto.mimeType
        asset.size = createDto.size
        asset.checksum = createDto.checksum

        await asset.save()

        return asset.toJSON()
    }

    async findExpiredIncomplete(expiresBefore: Date): Promise<Asset[]> {
        // cycle-19: lean-virtuals 플러그인 제거 + leanToPublic (cycle-06 패턴).
        const docs = await this.model
            .find({ createdAt: { $lte: expiresBefore }, ownerEntityId: null, ownerService: null })
            .lean()
        return leanArrayToPublic<Asset>(docs)
    }
}
