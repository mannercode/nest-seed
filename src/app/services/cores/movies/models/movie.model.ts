import { Prop, Schema } from '@nestjs/mongoose'
import { MongooseSchema, createMongooseSchema } from 'common'
import { MongooseConfig } from 'config'
import { HydratedDocument, Types } from 'mongoose'
import { MovieGenre, MovieRating } from 'services/types'

@Schema(MongooseConfig.schemaOptions)
export class Movie extends MongooseSchema {
    @Prop({ required: true })
    title: string

    @Prop({ type: [String], enum: MovieGenre, default: [] })
    genre: MovieGenre[]

    @Prop({ required: true })
    releaseDate: Date

    @Prop({ default: '' })
    plot: string

    @Prop({ required: true })
    durationMinutes: number

    @Prop({ default: 'John Doe' })
    director: string

    @Prop({ type: String, enum: MovieRating })
    rating: MovieRating

    @Prop({ required: true })
    imageFileIds: Types.ObjectId[]
}
export type MovieDocument = HydratedDocument<Movie>
export const MovieSchema = createMongooseSchema(Movie)
