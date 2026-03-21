import { MongooseRepository } from '@mannercode/nest-common'
import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { MongooseConfigModule } from 'app-common'
import { Model } from 'mongoose'
import { CreateAssetDto } from './dtos'
import { Asset } from './models'

@Injectable()
export class AssetsRepository extends MongooseRepository<Asset> {
    constructor(
        @InjectModel(Asset.name, MongooseConfigModule.connectionName)
        readonly model: Model<Asset>
    ) {
        super(model, MongooseConfigModule.maxTake)
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
        return this.model
            .find({ createdAt: { $lte: expiresBefore }, ownerEntityId: null, ownerService: null })
            .lean({ virtuals: true })
    }
}
