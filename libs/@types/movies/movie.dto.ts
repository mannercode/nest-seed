export enum MovieGenre {
    Action = 'Action',
    Comedy = 'Comedy',
    Drama = 'Drama',
    Fantasy = 'Fantasy',
    Horror = 'Horror',
    Mystery = 'Mystery',
    Romance = 'Romance',
    Thriller = 'Thriller',
    Western = 'Western'
}

export enum MovieRating {
    G = 'G',
    PG = 'PG',
    PG13 = 'PG13',
    R = 'R',
    NC17 = 'NC17'
}

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
