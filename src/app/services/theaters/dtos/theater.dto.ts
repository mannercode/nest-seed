import { LatLong } from 'common'
import { Seatmap, Theater } from '../models'

export class TheaterDto {
    id: string
    name: string
    latlong: LatLong
    seatmap: Seatmap

    constructor(theater: Theater) {
        const { createdAt, updatedAt, __v, ...rest } = theater

        Object.assign(this, rest)
    }
}
