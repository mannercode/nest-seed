export class ShowtimeDto {
    id: string
    theaterId: string
    movieId: string
    startTime: Date
    endTime: Date
}

export const nullShowtimeDto = {
    id: '',
    theaterId: '',
    movieId: '',
    startTime: new Date(0),
    endTime: new Date(0)
}
