import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { MongooseRepository, QueryBuilder } from 'common'
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

    async addAsset(movieId: string, assetId: string) {
        const asset = this.newDocument()
        asset.assetId = assetId
        asset.movieId = movieId
        await asset.save()

        return asset.toJSON()
    }

    async removeAsset(movieId: string, assetId: string): Promise<boolean> {
        const builder = new QueryBuilder<MoviePendingAsset>()
        builder.addEqual('movieId', movieId)
        builder.addEqual('assetId', assetId)
        const query = builder.build({})

        await this.model.deleteOne(query).exec()

        return true
    }
}
