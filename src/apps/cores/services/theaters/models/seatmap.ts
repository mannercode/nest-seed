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
    seatNumber: number
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

    static getAllSeats = (seatmap: Seatmap) => Array.from(this.seatsIterator(seatmap))

    static getSeatCount = (seatmap: Seatmap) => {
        let seatCount = 0

        for (const block of seatmap.blocks) {
            for (const row of block.rows) {
                for (let seatIndex = 0; seatIndex < row.seats.length; seatIndex++) {
                    if (row.seats[seatIndex] !== 'X') {
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
                for (let seatIndex = 0; seatIndex < row.seats.length; seatIndex++) {
                    if (row.seats[seatIndex] !== 'X') {
                        yield { block: block.name, row: row.name, seatNumber: seatIndex + 1 }
                    }
                }
            }
        }
    }
}
