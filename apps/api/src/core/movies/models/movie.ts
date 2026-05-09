import { createCrudSchema, CrudSchema } from '@mannercode/common'
import { Prop, Schema } from '@nestjs/mongoose'
import { MongooseConfigModule } from 'shared'
import { MovieDefaults } from './movie-defaults'

export const MovieGenre = {
    Action: 'action',
    Comedy: 'comedy',
    Drama: 'drama',
    Fantasy: 'fantasy',
    Horror: 'horror',
    Mystery: 'mystery',
    Romance: 'romance',
    Thriller: 'thriller',
    Western: 'western'
} as const

export type MovieGenre = (typeof MovieGenre)[keyof typeof MovieGenre]

export const MovieRating = {
    G: 'G',
    NC17: 'NC17',
    PG: 'PG',
    PG13: 'PG13',
    R: 'R',
    Unrated: 'Unrated'
} as const

export type MovieRating = (typeof MovieRating)[keyof typeof MovieRating]

function required(this: Movie) {
    return this.isPublished
}

const defaults = MovieDefaults

@Schema(MongooseConfigModule.schemaOptions)
export class Movie extends CrudSchema {
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
export const MovieSchema = createCrudSchema(Movie)

// 검색 인덱스 없음. cycle-31 substring 회귀로 title 인덱스가 활용 못 하게
// 되어 모두 제거. isPublished prefix 의 좁히기 효과는 seed 규모에서 marginal.
