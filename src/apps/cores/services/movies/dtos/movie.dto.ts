import { MovieGenre, MovieRating } from '../models'

export class MovieDto {
    id: string
    title: string
    genres: MovieGenre[]
    releaseDate: Date
    plot: string
    durationInSeconds: number
    director: string
    rating: MovieRating
    imageUrls: string[]
}
