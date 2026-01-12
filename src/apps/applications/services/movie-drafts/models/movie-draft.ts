import { Prop, Schema } from '@nestjs/mongoose'
import { MovieGenre, MovieRating } from 'apps/cores'
import { MongooseSchema, createMongooseSchema } from 'common'
import { HydratedDocument } from 'mongoose'
import { MongooseConfigModule } from 'shared'
import { MovieDraftAsset, MovieDraftAssetSchema } from './movie-draft-asset'

@Schema(MongooseConfigModule.schemaOptions)
export class MovieDraft extends MongooseSchema {
    @Prop()
    title?: string

    @Prop({ type: [String], enum: MovieGenre, default: [] })
    genres: MovieGenre[]

    @Prop()
    releaseDate?: Date

    @Prop()
    plot?: string

    @Prop()
    durationInSeconds?: number

    @Prop()
    director?: string

    @Prop({ type: String, enum: MovieRating })
    rating?: MovieRating

    @Prop({ type: [MovieDraftAssetSchema], default: [] })
    assets: MovieDraftAsset[]
}

export type MovieDraftDocument = HydratedDocument<MovieDraft>
export const MovieDraftSchema = createMongooseSchema(MovieDraft)
