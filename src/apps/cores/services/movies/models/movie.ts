import { createMongooseSchema, MongooseSchema } from '@mannercode/nest-common'
import { Prop, Schema } from '@nestjs/mongoose'
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
    G = 'G',
    NC17 = 'NC17',
    PG = 'PG',
    PG13 = 'PG13',
    R = 'R',
    Unrated = 'Unrated'
}

function required(this: Movie) {
    return this.isPublished
}

const { defaults } = Rules.Movie

@Schema(MongooseConfigModule.schemaOptions)
export class Movie extends MongooseSchema {
    @Prop({ default: [], type: [String] })
    assetIds: string[]

    @Prop({ default: defaults.director, required })
    director: string

    @Prop({ default: false, required: true })
    isPublished: boolean

    @Prop({
        default: defaults.durationInSeconds,
        validate: {
            message: 'Published movies must have a duration of at least 1 second',
            validator(this: Movie, value: number) {
                return !this.isPublished || value > 0
            }
        }
    })
    durationInSeconds: number

    @Prop({
        default: [],
        enum: MovieGenre,
        required,
        type: [String],
        validate: {
            message: 'Published movies must have at least one genre',
            validator(this: Movie, value: MovieGenre[]) {
                return !this.isPublished || value.length > 0
            }
        }
    })
    genres: MovieGenre[]

    @Prop({ default: defaults.plot, required })
    plot: string

    @Prop({
        default: defaults.rating,
        enum: MovieRating,
        validate: {
            message: 'Published movies cannot be unrated',
            validator(this: Movie, value: MovieRating) {
                return !this.isPublished || value !== defaults.rating
            }
        }
    })
    rating: MovieRating

    @Prop({ default: defaults.releaseDate })
    releaseDate: Date

    @Prop({ default: defaults.title, required })
    title: string
}
export const MovieSchema = createMongooseSchema(Movie)
