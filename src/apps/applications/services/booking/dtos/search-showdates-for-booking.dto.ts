import { IsNotEmpty, IsString } from 'class-validator'

export class SearchShowdatesForBookingDto {
    @IsNotEmpty()
    @IsString()
    movieId: string

    @IsNotEmpty()
    @IsString()
    theaterId: string
}
