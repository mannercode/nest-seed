import { MovieGenre, MovieRating } from 'services/types'

export class MovieDto {
    id: string
    title: string
    genre: MovieGenre[]
    releaseDate: Date
    plot: string
    durationMinutes: number
    director: string
    rating: MovieRating
    images: string[]
}
