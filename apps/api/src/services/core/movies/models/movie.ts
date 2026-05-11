import { createCrudSchema, CrudSchema } from '@mannercode/common'
import { Prop, Schema } from '@nestjs/mongoose'
import { MONGOOSE_SCHEMA_OPTIONS } from 'config'
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

@Schema(MONGOOSE_SCHEMA_OPTIONS)
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

// 검색 인덱스는 두지 않는다. 검색이 부분 문자열 정규식이라 인덱스를 타지
// 못한다. `isPublished` 만으로 만든 인덱스도 시드 규모(수만 행)에서는 효과가
// 거의 없다.
