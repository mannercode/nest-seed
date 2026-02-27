import { Type } from 'class-transformer'
import { IsNotEmpty, IsNumber, IsString, ValidateNested } from 'class-validator'

export class Seat {
    @IsNotEmpty()
    @IsString()
    block: string

    @IsNotEmpty()
    @IsString()
    row: string

    @IsNumber()
    seatNumber: number
}

export class SeatRow {
    @IsNotEmpty()
    @IsString()
    name: string

    @IsNotEmpty()
    @IsString()
    layout: string
}

export class SeatBlock {
    @IsNotEmpty()
    @IsString()
    name: string

    @Type(() => SeatRow)
    @ValidateNested({ each: true })
    rows: SeatRow[]
}

export class Seatmap {
    @Type(() => SeatBlock)
    @ValidateNested({ each: true })
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
