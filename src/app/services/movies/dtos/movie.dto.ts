import { Movie, MovieGenre, MovieRating } from '../models'

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

    constructor(movie: Movie) {
        const {
            id,
            title,
            genre,
            releaseDate,
            plot,
            durationMinutes,
            director,
            rating,
            storageFileIds
        } = movie

        Object.assign(this, {
            id,
            title,
            genre,
            releaseDate,
            plot,
            durationMinutes,
            director,
            rating,
            images: [`/storage-files/${storageFileIds.map((id) => id.toString())}`]
        })
    }
}
