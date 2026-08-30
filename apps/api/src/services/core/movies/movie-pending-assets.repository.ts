import { CrudRepository, DateUtil, QueryBuilder } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { AppConfigService, MongoConnection } from '#config'
import { MoviePendingAsset } from './models/index.js'

@Injectable()
export class MoviePendingAssetsRepository extends CrudRepository<MoviePendingAsset> {
    constructor(connection: MongoConnection, config: AppConfigService) {
        super(
            connection.db.collection('moviependingassets'),
            connection.client,
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
        const builder = new QueryBuilder<MoviePendingAsset>()
        builder.addEquals('movieId', movieId)
        builder.addEquals('assetId', assetId)
        const query = builder.build({})

        const count = await this.collection.countDocuments(this.activeFilter(query))
        return 0 < count
    }

    async findAssetIdsByMovieIds(movieIds: string[]): Promise<string[]> {
        const builder = new QueryBuilder<MoviePendingAsset>()
        builder.addIn('movieId', movieIds)
        const query = builder.build({})

        return this.collection.distinct<string>('assetId', this.activeFilter(query))
    }

    async removeByMovieIds(movieIds: string[]): Promise<void> {
        const builder = new QueryBuilder<MoviePendingAsset>()
        builder.addIn('movieId', movieIds)
        const query = builder.build({})

        await this.collection.updateMany(
            this.activeFilter(query),
            this.timestamped({ $set: { deletedAt: DateUtil.now() } })
        )
    }

    async removePendingAsset(movieId: string, assetId: string): Promise<void> {
        const builder = new QueryBuilder<MoviePendingAsset>()
        builder.addEquals('movieId', movieId)
        builder.addEquals('assetId', assetId)
        const query = builder.build({})

        await this.collection.updateOne(
            this.activeFilter(query),
            this.timestamped({ $set: { deletedAt: DateUtil.now() } })
        )
    }
}
