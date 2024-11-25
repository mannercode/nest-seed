import { Prop, Schema } from '@nestjs/mongoose'
import { ModelAttributes, MongooseSchema, ObjectId, createMongooseSchema } from 'common'
import * as mongooseDelete from 'mongoose-delete'

export enum MovieGenre {
    Action = 'Action',
    Comedy = 'Comedy',
    Drama = 'Drama',
    Fantasy = 'Fantasy',
    Horror = 'Horror',
    Mystery = 'Mystery',
    Romance = 'Romance',
    Thriller = 'Thriller',
    Western = 'Western'
}

export enum MovieRating {
    G = 'G',
    PG = 'PG',
    PG13 = 'PG13',
    R = 'R',
    NC17 = 'NC17'
}

@Schema()
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

    @Prop({ type: ObjectId, required: true })
    posterFileIds: ObjectId[]
}

export const MovieSchema = createMongooseSchema(Movie)
MovieSchema.plugin(mongooseDelete, { deletedAt: true, overrideMethods: 'all' })
