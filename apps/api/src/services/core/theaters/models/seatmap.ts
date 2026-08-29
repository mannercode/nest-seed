import { z } from 'zod'
import type { Seat } from './seat.js'

const requiredString = z
    .union([z.string(), z.number(), z.boolean()])
    .transform(String)
    .pipe(z.string().min(1))

export const SeatRowSchema = z.strictObject({ layout: requiredString, name: requiredString })

export class SeatRow {
    name: string

    layout: string
}

export const SeatBlockSchema = z.strictObject({
    name: requiredString,
    rows: z.array(SeatRowSchema)
})

export class SeatBlock {
    name: string

    rows: SeatRow[]
}

export const SeatmapSchema = z.strictObject({ blocks: z.array(SeatBlockSchema) })

export class Seatmap {
    blocks: SeatBlock[]

    static getAllSeats(seatmap: Seatmap) {
        return Array.from(this.seatsIterator(seatmap))
    }

    static getSeatCount(seatmap: Seatmap) {
        let seatCount = 0

        for (const block of seatmap.blocks) {
            for (const row of block.rows) {
                for (let seatIndex = 0; seatIndex < row.layout.length; seatIndex++) {
                    if (row.layout[seatIndex] !== 'X') {
                        seatCount = seatCount + 1
                    }
                }
            }
        }

        return seatCount
    }

    static *seatsIterator(seatmap: Seatmap): IterableIterator<Seat> {
        for (const block of seatmap.blocks) {
            for (const row of block.rows) {
                for (let seatIndex = 0; seatIndex < row.layout.length; seatIndex++) {
                    if (row.layout[seatIndex] !== 'X') {
                        yield { block: block.name, row: row.name, seatNumber: seatIndex + 1 }
                    }
                }
            }
        }
    }
}
