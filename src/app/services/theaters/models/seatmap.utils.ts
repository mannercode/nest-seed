import { Seat, Seatmap } from './seatmap.model'

export function getSeatCount(seatmap: Seatmap) {
    let count = 0

    for (const block of seatmap.blocks) {
        for (const row of block.rows) {
            for (let i = 0; i < row.seats.length; i++) {
                if (row.seats[i] !== 'X') {
                    count = count + 1
                }
            }
        }
    }

    return count
}

function* seatsIterator(seatmap: Seatmap): IterableIterator<Seat> {
    for (const block of seatmap.blocks) {
        for (const row of block.rows) {
            for (let i = 0; i < row.seats.length; i++) {
                if (row.seats[i] !== 'X') {
                    yield {
                        block: block.name,
                        row: row.name,
                        seatnum: i + 1
                    }
                }
            }
        }
    }
}

export const getAllSeats = (seatmap: Seatmap) => Array.from(seatsIterator(seatmap))
