import { CrudDocument } from '@mannercode/common'
import type { Seatmap } from './seatmap.js'
import type { TheaterLocation } from './theater-location.js'

export class Theater extends CrudDocument {
    location: TheaterLocation

    name: string

    seatmap: Seatmap
}
