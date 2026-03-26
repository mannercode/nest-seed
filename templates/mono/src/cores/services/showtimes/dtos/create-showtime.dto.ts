import { IsDate, IsNotEmpty, IsString } from 'class-validator'

export class CreateShowtimeDto {
    @IsDate()
    endTime: Date

    @IsNotEmpty()
    @IsString()
    movieId: string

    @IsNotEmpty()
    @IsString()
    sagaId: string

    @IsDate()
    startTime: Date

    @IsNotEmpty()
    @IsString()
    theaterId: string
}
