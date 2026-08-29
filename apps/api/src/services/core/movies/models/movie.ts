import { CrudDocument } from '@mannercode/common'

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

export class Movie extends CrudDocument {
    assetIds: string[]

    director: string

    isPublished: boolean

    durationInSeconds: number

    genres: MovieGenre[]

    plot: string

    rating: MovieRating

    releaseDate: Date

    title: string
}
