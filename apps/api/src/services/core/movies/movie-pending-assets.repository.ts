import { CrudRepository, QueryBuilder } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { MongooseConfigModule } from 'config'
import { Model } from 'mongoose'
import { MoviePendingAsset } from './models'

@Injectable()
export class MoviePendingAssetsRepository extends CrudRepository<MoviePendingAsset> {
    constructor(
        @InjectModel(MoviePendingAsset.name, MongooseConfigModule.connectionName)
        readonly model: Model<MoviePendingAsset>
    ) {
        super(model, MongooseConfigModule.maxTake)
    }

    async addPendingAsset(movieId: string, assetId: string) {
        const pendingAsset = this.newDocument()
        pendingAsset.assetId = assetId
        pendingAsset.movieId = movieId
        await pendingAsset.save()

        return pendingAsset.toJSON()
    }

    async hasPendingAsset(movieId: string, assetId: string): Promise<boolean> {
        const builder = new QueryBuilder<MoviePendingAsset>()
        builder.addEquals('movieId', movieId)
        builder.addEquals('assetId', assetId)
        const query = builder.build({})

        const count = await this.model.countDocuments(query)
        return 0 < count
    }

    async removePendingAsset(movieId: string, assetId: string): Promise<void> {
        const builder = new QueryBuilder<MoviePendingAsset>()
        builder.addEquals('movieId', movieId)
        builder.addEquals('assetId', assetId)
        const query = builder.build({})

        // createCrudSchema 의 soft-delete static 은 Promise<{deletedCount}> 를
        // 직접 반환하므로 `.exec()` 체인을 걸지 않는다 (기존 raw schema 의
        // Query 객체 반환 가정과 다름).
        await this.model.deleteOne(query)
    }
}
