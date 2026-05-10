import { createCrudSchema, CrudSchema } from '@mannercode/common'
import { Prop, Schema } from '@nestjs/mongoose'
import { MONGOOSE_SCHEMA_OPTIONS } from 'config'

@Schema(MONGOOSE_SCHEMA_OPTIONS)
export class MoviePendingAsset extends CrudSchema {
    @Prop({ required: true })
    assetId: string

    @Prop({ required: true })
    movieId: string
}

export const MoviePendingAssetSchema = createCrudSchema(MoviePendingAsset)
