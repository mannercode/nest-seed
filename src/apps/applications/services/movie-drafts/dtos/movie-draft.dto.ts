import { MovieGenre, MovieRating } from 'apps/cores'
import { MovieDraftImageStatus } from '../models/movie-draft'

export type DraftImageStatus = (typeof MovieDraftImageStatus)[keyof typeof MovieDraftImageStatus]

export class MovieDraftImageDto {
    id: string
    status: DraftImageStatus
}

export class MovieDraftDto {
    id: string
    expiresAt: Date
    title?: string
    genres?: MovieGenre[]
    releaseDate?: Date
    plot?: string
    durationInSeconds?: number
    director?: string
    rating?: MovieRating
    imageAssetIds: string[]
    images: MovieDraftImageDto[]
}
