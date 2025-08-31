import { Prop, Schema } from '@nestjs/mongoose'
import { MongooseSchema, createMongooseSchema } from 'common'
import { HydratedDocument, Types } from 'mongoose'
import { MongooseConfigModule } from 'shared'

// TODO 확장자 .model은 지워라. 다른 곳도 마찬가지

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

    @Prop({ type: [String], enum: MovieGenre, default: [] })
    genres: MovieGenre[]

    @Prop({ required: true })
    releaseDate: Date

    @Prop({ default: '' })
    plot: string

    @Prop({ required: true })
    durationInSeconds: number

    @Prop({ default: 'John Doe' })
    director: string

    @Prop({ type: String, enum: MovieRating })
    rating: MovieRating

    @Prop({ required: true })
    imageIds: Types.ObjectId[]
}
export type MovieDocument = HydratedDocument<Movie>
export const MovieSchema = createMongooseSchema(Movie)
