import { Prop, Schema } from '@nestjs/mongoose'
import { createMongooseSchema, MongooseSchema } from 'common'
import { HydratedDocument, Types } from 'mongoose'
import { MongooseConfigModule } from 'shared'
import { MovieGenre, MovieRating } from './movie'

@Schema(MongooseConfigModule.schemaOptions)
export class MovieDraft extends MongooseSchema {
    @Prop()
    title?: string

    @Prop({ type: [String], enum: MovieGenre })
    genres?: MovieGenre[]

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

    @Prop()
    imageIds?: Types.ObjectId[]

    @Prop({ required: true })
    expiresAt: Date
}
export type MovieDraftDocument = HydratedDocument<MovieDraft>
export const MovieDraftSchema = createMongooseSchema(MovieDraft)
