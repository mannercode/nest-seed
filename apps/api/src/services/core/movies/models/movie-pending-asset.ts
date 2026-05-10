import { createCrudSchema, CrudSchema } from '@mannercode/common'
import { Prop, Schema } from '@nestjs/mongoose'
import { MongooseSetupModule } from 'modules'

@Schema(MongooseSetupModule.schemaOptions)
export class MoviePendingAsset extends CrudSchema {
    @Prop({ required: true })
    assetId: string

    @Prop({ required: true })
    movieId: string
}

export const MoviePendingAssetSchema = createCrudSchema(MoviePendingAsset)
