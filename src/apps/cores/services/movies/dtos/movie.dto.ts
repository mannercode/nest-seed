
import { MovieGenre, MovieRating } from '../models'

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

export const nullMovieDto = {
    id: '',
    title: '',
    genre: [],
    releaseDate: new Date(0),
    plot: '',
    durationMinutes: 0,
    director: '',
    rating: MovieRating.G,
    images: []
}
