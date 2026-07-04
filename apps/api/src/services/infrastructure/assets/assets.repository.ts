import { CrudRepository, leanArrayToPublic, objectId } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { AppConfigService, MONGO_CONNECTION_NAME } from 'config'
import { Model } from 'mongoose'
import { CreateAssetDto } from './dtos'
import { Asset } from './models'

@Injectable()
export class AssetsRepository extends CrudRepository<Asset> {
    constructor(
        @InjectModel(Asset.name, MONGO_CONNECTION_NAME)
        readonly model: Model<Asset>,
        config: AppConfigService
    ) {
        super(model, config.http.paginationDefaultSize, config.http.paginationMaxSize)
    }

    async assignOwner(
        assetId: string,
        owner: { entityId: string; service: string },
        createdAfter: Date
    ) {
        // 만료 정리 cron과의 경쟁을 조건부 원자 갱신으로 닫는다 — 아직 만료 전(createdAt > createdAfter)인 행만 소유를 얻는다.
        // cron은 "만료됐고 무소유"인 행만 지우므로, 이 갱신이 성공한 자산을 cron이 지우는 일은 없다.
        // 만료됐거나 이미 삭제된 행이면 null을 반환한다.
        const doc = await this.model.findOneAndUpdate(
            { _id: objectId(assetId), createdAt: { $gt: createdAfter } },
            { $set: { ownerEntityId: owner.entityId, ownerService: owner.service } },
            { new: true }
        )
        return doc ? doc.toJSON() : null
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
        const docs = await this.model
            .find({ createdAt: { $lte: expiresBefore }, ownerEntityId: null, ownerService: null })
            .lean()
        return leanArrayToPublic<Asset>(docs)
    }
}
