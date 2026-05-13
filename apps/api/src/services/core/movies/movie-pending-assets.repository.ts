import { CrudRepository, QueryBuilder } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { AppConfigService, MONGO_CONNECTION_NAME } from 'config'
import { Model } from 'mongoose'
import { MoviePendingAsset } from './models'

@Injectable()
export class MoviePendingAssetsRepository extends CrudRepository<MoviePendingAsset> {
    constructor(
        @InjectModel(MoviePendingAsset.name, MONGO_CONNECTION_NAME)
        readonly model: Model<MoviePendingAsset>,
        config: AppConfigService
    ) {
        super(model, config.http.paginationDefaultSize)
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

        // `createCrudSchema`가 만들어 준 soft-delete 정적 메서드는 mongoose의
        // Query 객체가 아니라 `Promise<{ deletedCount }>`를 바로 반환한다.
        // 그래서 `.exec()`를 붙이지 않는다.
        await this.model.deleteOne(query)
    }
}
