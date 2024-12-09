import { Type } from 'class-transformer'
import { IsNotEmpty, IsNumber, IsString, ValidateNested } from 'class-validator'

export class Seat {
    @IsString()
    @IsNotEmpty()
    block: string

    @IsString()
    @IsNotEmpty()
    row: string

    @IsNumber()
    seatnum: number
}

export class SeatRow {
    @IsString()
    @IsNotEmpty()
    name: string

    @IsString()
    @IsNotEmpty()
    seats: string
}

export class SeatBlock {
    @IsString()
    @IsNotEmpty()
    name: string

    @ValidateNested({ each: true })
    @Type(() => SeatRow)
    rows: SeatRow[]
}

export class Seatmap {
    @ValidateNested({ each: true })
    @Type(() => SeatBlock)
    blocks: SeatBlock[]

    static getAllSeats = (seatmap: Seatmap) => Array.from(seatsIterator(seatmap))
    static getSeatCount = (seatmap: Seatmap) => {
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
