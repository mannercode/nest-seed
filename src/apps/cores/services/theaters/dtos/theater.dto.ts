import { LatLong, nullLatLong } from 'common'
import { nullSeatmap, Seatmap } from '../models'

export class TheaterDto {
    id: string
    name: string
    latlong: LatLong
    seatmap: Seatmap
}

export const nullTheaterDto = {
    id: '',
    name: '',
    latlong: nullLatLong,
    seatmap: nullSeatmap
}
