import { Showtime } from '../models'

export class ShowtimeDto {
    id: string
    startTime: Date
    endTime: Date
    theaterId: string
    movieId: string

    constructor(showtime: Showtime) {
        const { createdAt, updatedAt, __v, batchId, ...rest } = showtime

        Object.assign(this, rest)
        // const { id, startTime, endTime, theaterId, movieId } = showtime

        // Object.assign(this, {
        //     id: id.toString(),
        //     startTime,
        //     endTime,
        //     theaterId: theaterId.toString(),
        //     movieId: movieId.toString()
        // })
    }
}
