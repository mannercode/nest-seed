import type { Seatmap, TheaterLocation } from '../models'

export class TheaterDto {
    id: string
    location: TheaterLocation
    name: string
    seatmap: Seatmap
}
