import type { Seatmap, TheaterLocation } from '../models'

export class TheaterDto {
    id: string
    name: string
    location: TheaterLocation
    seatmap: Seatmap
}
