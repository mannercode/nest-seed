import { Type } from 'class-transformer'
import { IsNotEmpty, IsNumber, IsString, ValidateNested } from 'class-validator'

export class Seatmap {
    @ValidateNested({ each: true })
    @Type(() => SeatBlock)
    blocks: SeatBlock[]
}

export class SeatBlock {
    @IsString()
    @IsNotEmpty()
    name: string

    @ValidateNested({ each: true })
    @Type(() => SeatRow)
    rows: SeatRow[]
}

export class SeatRow {
    @IsString()
    @IsNotEmpty()
    name: string

    @IsString()
    @IsNotEmpty()
    seats: string
}

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
