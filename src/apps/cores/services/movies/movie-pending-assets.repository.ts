import { MongooseRepository, QueryBuilder } from '@mannercode/nestlib-common'
import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { MongooseConfigModule } from 'shared'
import { MoviePendingAsset } from './models'

@Injectable()
export class MoviePendingAssetsRepository extends MongooseRepository<MoviePendingAsset> {
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
        builder.addEqual('movieId', movieId)
        builder.addEqual('assetId', assetId)
        const query = builder.build({})

        const count = await this.model.countDocuments(query)
        return 0 < count
    }

    async removePendingAsset(movieId: string, assetId: string): Promise<void> {
        const builder = new QueryBuilder<MoviePendingAsset>()
        builder.addEqual('movieId', movieId)
        builder.addEqual('assetId', assetId)
        const query = builder.build({})

        await this.model.deleteOne(query).exec()
    }
}
