import type { MovieGenre, MovieRating } from '../models'

export class MovieDto {
    director: string
    durationInSeconds: number
    genres: MovieGenre[]
    id: string
    imageUrls: string[]
    plot: string
    rating: MovieRating
    releaseDate: Date
    title: string
}
