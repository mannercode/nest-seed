import {
    CrudRepository,
    DateUtil,
    MongoConnection,
    type TransactionContext
} from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { AppConfigService } from '#config'
import { CreateAssetDto } from './dtos/index.js'
import { Asset } from './models/index.js'

@Injectable()
export class AssetsRepository extends CrudRepository<Asset> {
    constructor(connection: MongoConnection, config: AppConfigService) {
        super(
            connection,
            'assets',
            config.http.paginationDefaultSize,
            config.http.paginationMaxSize
        )
    }

    async assignOwner(
        assetId: string,
        owner: { entityId: string; service: string },
        createdAfter: Temporal.Instant,
        transaction?: TransactionContext
    ) {
        // 최초 소유권은 만료 전 무소유 자산에만 부여한다. 같은 소유자의 완료 재시도는
        // 업로드 만료와 관계없이 허용하고, 다른 소유자로 덮어쓰지는 않는다.
        const doc = await this.findAndUpdateDocument(
            this.activeFilter({
                ...this.idFilter(assetId),
                deletionRequestedAt: null,
                $or: [
                    { ownerEntityId: owner.entityId, ownerService: owner.service },
                    { ownerEntityId: null, ownerService: null, createdAt: { $gt: createdAfter } }
                ]
            }),
            this.timestamped({
                $set: { ownerEntityId: owner.entityId, ownerService: owner.service }
            }),
            { returnDocument: 'after', transaction }
        )
        return doc
    }

    async create(createDto: CreateAssetDto) {
        const asset = this.newDocument()
        asset.originalName = createDto.originalName
        asset.mimeType = createDto.mimeType
        asset.size = createDto.size
        asset.checksum = createDto.checksum
        asset.ownerEntityId = null
        asset.ownerService = null
        asset.deletionRequestedAt = null
        asset.storageCleanedAt = null

        return this.insertOne(asset)
    }

    async requestExpiredDeletion(expiresBefore: Temporal.Instant): Promise<void> {
        await this.updateDocuments(
            this.activeFilter({
                createdAt: { $lte: expiresBefore },
                deletionRequestedAt: null,
                ownerEntityId: null,
                ownerService: null
            }),
            this.timestamped({ $set: { deletionRequestedAt: DateUtil.now() } })
        )
    }

    async requestDeletion(assetIds: string[]): Promise<void> {
        await this.updateDocuments(
            this.activeFilter({ ...this.idsFilter(assetIds), deletionRequestedAt: null }),
            this.timestamped({ $set: { deletionRequestedAt: DateUtil.now() } })
        )
    }

    async findPendingDeletion(expiresBefore: Temporal.Instant): Promise<Asset[]> {
        return this.findDocuments({
            $or: [
                { deletedAt: null, deletionRequestedAt: { $ne: null } },
                { deletedAt: { $ne: null, $lte: expiresBefore }, storageCleanedAt: null }
            ]
        })
    }

    async markStorageCleaned(assetIds: string[], expiresBefore: Temporal.Instant): Promise<void> {
        await this.updateDocuments(
            {
                ...this.idsFilter(assetIds),
                deletedAt: { $ne: null, $lte: expiresBefore },
                storageCleanedAt: null
            },
            this.timestamped({ $set: { storageCleanedAt: DateUtil.now() } })
        )
    }
}
