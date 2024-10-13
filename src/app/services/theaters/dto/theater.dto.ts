import { LatLong } from 'common'
import { Seatmap, Theater } from '../schemas'

export class TheaterDto {
    id: string
    name: string
    latlong: LatLong
    seatmap: Seatmap

    constructor(theater: Theater) {
        const { id, name, latlong, seatmap } = theater

        Object.assign(this, { id: id.toString(), name, latlong, seatmap })
    }
}
