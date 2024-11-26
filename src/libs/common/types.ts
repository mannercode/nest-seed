import { Type } from 'class-transformer'
import { IsDate, IsNumber, Max, Min } from 'class-validator'

export type Resolve = (value: unknown) => void
export type Reject = (reason?: any) => void

export class LatLong {
    @IsNumber()
    @Min(-90)
    @Max(90)
    latitude: number

    @IsNumber()
    @Min(-180)
    @Max(180)
    longitude: number
}

export class DateRange {
    @IsDate()
    @Type(() => Date)
    start?: Date

    @IsDate()
    @Type(() => Date)
    end?: Date
}
