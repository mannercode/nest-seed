import { Prop, Schema } from '@nestjs/mongoose'
import { MongooseSchema, createMongooseSchema } from 'common'
import { MongooseConfigModule, Rules } from 'shared'

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
    Unrated = 'Unrated',
    G = 'G',
    PG = 'PG',
    PG13 = 'PG13',
    R = 'R',
    NC17 = 'NC17'
}

function required(this: Movie) {
    return this.isPublished
}

const { defaults } = Rules.Movie

@Schema(MongooseConfigModule.schemaOptions)
export class Movie extends MongooseSchema {
    @Prop({ required, default: defaults.title })
    title: string

    @Prop({ required, default: defaults.plot })
    plot: string

    @Prop({ required, default: defaults.director })
    director: string

    @Prop({ default: defaults.releaseDate })
    releaseDate: Date

    @Prop({
        default: defaults.durationInSeconds,
        validate: {
            validator: function (this: Movie, value: number) {
                return !this.isPublished || value > 0
            },
            message: 'Published movies must have a duration of at least 1 second'
        }
    })
    durationInSeconds: number

    @Prop({
        enum: MovieRating,
        default: defaults.rating,
        validate: {
            validator: function (this: Movie, value: MovieRating) {
                return !this.isPublished || value !== defaults.rating
            },
            message: 'Published movies cannot be unrated'
        }
    })
    rating: MovieRating

    @Prop({
        required,
        type: [String],
        enum: MovieGenre,
        default: [],
        validate: {
            validator: function (this: Movie, value: MovieGenre[]) {
                return !this.isPublished || value.length > 0
            },
            message: 'Published movies must have at least one genre'
        }
    })
    genres: MovieGenre[]

    @Prop({ type: [String], default: [] })
    assetIds: string[]

    @Prop({ required: true, default: false })
    isPublished: boolean
}
export const MovieSchema = createMongooseSchema(Movie)
