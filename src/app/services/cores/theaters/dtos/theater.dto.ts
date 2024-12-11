import { LatLong } from 'common'
import { Seatmap } from '../models'

export class TheaterDto {
    id: string
    name: string
    latlong: LatLong
    seatmap: Seatmap
}
