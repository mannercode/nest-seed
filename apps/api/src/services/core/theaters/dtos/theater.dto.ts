import type { Seatmap, TheaterLocation } from '../models/index.js'

export class TheaterDto {
    id: string
    location: TheaterLocation
    name: string
    seatmap: Seatmap
}
