import { createCrudSchema, CrudSchema } from '@mannercode/common'
import { Prop, Schema } from '@nestjs/mongoose'
import { MongooseConfigModule } from 'config'

@Schema(MongooseConfigModule.schemaOptions)
export class MoviePendingAsset extends CrudSchema {
    @Prop({ required: true })
    assetId: string

    @Prop({ required: true })
    movieId: string
}

export const MoviePendingAssetSchema = createCrudSchema(MoviePendingAsset)
