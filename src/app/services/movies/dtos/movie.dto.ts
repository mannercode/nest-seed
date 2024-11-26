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

    constructor(movie: Movie, images: string[]) {
        // TODO 이거 안 쓰는데.. 이름 변경도 하고
        const { createdAt, updatedAt, __v, posterFileIds: storageFileIds, ...rest } = movie

        Object.assign(this, { ...rest, images })
    }
}
