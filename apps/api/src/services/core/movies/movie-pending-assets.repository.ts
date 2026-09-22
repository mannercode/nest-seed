import { CrudRepository, DateUtil, QueryBuilder, MongoConnection } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { AppConfigService } from '#config'
import { MoviePendingAsset } from './models/index.js'

@Injectable()
export class MoviePendingAssetsRepository extends CrudRepository<MoviePendingAsset> {
    constructor(connection: MongoConnection, config: AppConfigService) {
        super(
            connection,
            'moviependingassets',
            config.http.paginationDefaultSize,
            config.http.paginationMaxSize
        )
    }

    async addPendingAsset(movieId: string, assetId: string) {
        const pendingAsset = this.newDocument()
        pendingAsset.assetId = assetId
        pendingAsset.movieId = movieId
        return this.insertOne(pendingAsset)
    }

    async hasPendingAsset(movieId: string, assetId: string): Promise<boolean> {
        const builder = new QueryBuilder()
        builder.addEquals('movieId', movieId)
        builder.addEquals('assetId', assetId)
        const query = builder.build({})

        const count = await this.countDocuments(this.activeFilter(query))
        return 0 < count
    }

    async findAssetIds({ movieIds }: { movieIds: string[] }): Promise<string[]> {
        const builder = new QueryBuilder()
        builder.addIn('movieId', movieIds)
        const query = builder.build({})

        return this.distinctValues<string>('assetId', this.activeFilter(query))
    }

    async removeMany({ movieIds }: { movieIds: string[] }): Promise<void> {
        const builder = new QueryBuilder()
        builder.addIn('movieId', movieIds)
        const query = builder.build({})

        await this.updateDocuments(
            this.activeFilter(query),
            this.timestamped({ $set: { deletedAt: DateUtil.now() } })
        )
    }

    async removePendingAsset(movieId: string, assetId: string): Promise<void> {
        const builder = new QueryBuilder()
        builder.addEquals('movieId', movieId)
        builder.addEquals('assetId', assetId)
        const query = builder.build({})

        await this.updateDocument(
            this.activeFilter(query),
            this.timestamped({ $set: { deletedAt: DateUtil.now() } })
        )
    }
}
