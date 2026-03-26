import { Type } from 'class-transformer'
import { IsDate, IsNotEmpty, IsString } from 'class-validator'

export class BookingSearchShowtimesDto {
    @IsNotEmpty()
    @IsString()
    movieId: string

    @IsDate()
    @Type(() => Date)
    showdate: Date

    @IsNotEmpty()
    @IsString()
    theaterId: string
}
