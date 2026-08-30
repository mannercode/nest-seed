import { CrudRepository, mongoArrayToPublic, mongoToPublic, objectId } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { AppConfigService, MongoConnection } from '#config'
import { CreateAssetDto } from './dtos/index.js'
import { Asset } from './models/index.js'

@Injectable()
export class AssetsRepository extends CrudRepository<Asset> {
    constructor(connection: MongoConnection, config: AppConfigService) {
        super(
            connection.db.collection('assets'),
            connection.client,
            config.http.paginationDefaultSize,
            config.http.paginationMaxSize
        )
    }

    async assignOwner(
        assetId: string,
        owner: { entityId: string; service: string },
        createdAfter: Temporal.Instant
    ) {
        // 만료 정리 cron과의 경쟁을 조건부 원자 갱신으로 닫는다 — 아직 만료 전(createdAt > createdAfter)인 행만 소유를 얻는다.
        // cron은 "만료됐고 무소유"인 행만 지우므로, 이 갱신이 성공한 자산을 cron이 지우는 일은 없다.
        // 만료됐거나 이미 삭제된 행이면 null을 반환한다.
        const doc = await this.collection.findOneAndUpdate(
            this.activeFilter({ _id: objectId(assetId), createdAt: { $gt: createdAfter } }),
            this.timestamped({
                $set: { ownerEntityId: owner.entityId, ownerService: owner.service }
            }),
            { returnDocument: 'after' }
        )
        return mongoToPublic<Asset>(doc)
    }

    async create(createDto: CreateAssetDto) {
        const asset = this.newDocument()
        asset.originalName = createDto.originalName
        asset.mimeType = createDto.mimeType
        asset.size = createDto.size
        asset.checksum = createDto.checksum
        asset.ownerEntityId = null
        asset.ownerService = null

        return this.insertOne(asset)
    }

    async findExpiredIncomplete(expiresBefore: Temporal.Instant): Promise<Asset[]> {
        const docs = await this.collection
            .find(
                this.activeFilter({
                    createdAt: { $lte: expiresBefore },
                    ownerEntityId: null,
                    ownerService: null
                })
            )
            .toArray()
        return mongoArrayToPublic<Asset>(docs)
    }
}
