import type { MovieGenre, MovieRating } from 'apps/cores'

export class MovieDraftDto {
    id: string
    title?: string
    genres?: MovieGenre[]
    releaseDate?: Date
    plot?: string
    durationInSeconds?: number
    director?: string
    rating?: MovieRating
    assetIds: string[]
}
