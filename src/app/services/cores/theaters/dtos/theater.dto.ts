import { LatLong } from 'common'
import { Seatmap } from 'services/types'

export class TheaterDto {
    id: string
    name: string
    latlong: LatLong
    seatmap: Seatmap
}
