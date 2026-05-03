import { IsNumber, Max, Min } from 'class-validator'

export class TheaterLocation {
    @IsNumber()
    @Max(90)
    @Min(-90)
    latitude: number

    @IsNumber()
    @Max(180)
    @Min(-180)
    longitude: number
}
