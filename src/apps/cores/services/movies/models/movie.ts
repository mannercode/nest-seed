import { Prop, Schema } from '@nestjs/mongoose'
import { MongooseSchema, createMongooseSchema } from 'common'
import { HydratedDocument, Types } from 'mongoose'
import { MongooseConfigModule } from 'shared'

export enum MovieGenre {
    Action = 'action',
    Comedy = 'comedy',
    Drama = 'drama',
    Fantasy = 'fantasy',
    Horror = 'horror',
    Mystery = 'mystery',
    Romance = 'romance',
    Thriller = 'thriller',
    Western = 'western'
}

export enum MovieRating {
    G = 'G',
    PG = 'PG',
    PG13 = 'PG13',
    R = 'R',
    NC17 = 'NC17'
}

@Schema(MongooseConfigModule.schemaOptions)
export class Movie extends MongooseSchema {
    @Prop({ required: true })
    title: string

    @Prop({ required: true, type: [String], enum: MovieGenre, default: [] })
    genres: MovieGenre[]

    @Prop({ required: true })
    releaseDate: Date

    @Prop({ required: true, default: '' })
    plot: string

    @Prop({ required: true })
    durationInSeconds: number

    @Prop({ required: true, default: 'John Doe' })
    director: string

    @Prop({ required: true, type: String, enum: MovieRating })
    rating: MovieRating

    @Prop({ required: true })
    imageIds: Types.ObjectId[]
}
export type MovieDocument = HydratedDocument<Movie>
export const MovieSchema = createMongooseSchema(Movie)
