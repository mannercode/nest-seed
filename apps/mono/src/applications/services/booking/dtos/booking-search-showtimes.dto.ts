import { IsDate, IsNotEmpty, IsString } from 'class-validator'

export class BookingSearchShowtimesDto {
    @IsNotEmpty()
    @IsString()
    movieId: string

    @IsDate()
    showdate: Date

    @IsNotEmpty()
    @IsString()
    theaterId: string
}
