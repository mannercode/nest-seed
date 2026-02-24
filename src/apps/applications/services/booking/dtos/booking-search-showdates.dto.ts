import { IsNotEmpty, IsString } from 'class-validator'

export class BookingSearchShowdatesDto {
    @IsNotEmpty()
    @IsString()
    movieId: string

    @IsNotEmpty()
    @IsString()
    theaterId: string
}
