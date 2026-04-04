import { Type } from 'class-transformer'
import { IsDate, IsNotEmpty, IsString } from 'class-validator'

export class CreateShowtimeDto {
    @IsDate()
    @Type(() => Date)
    endTime: Date

    @IsNotEmpty()
    @IsString()
    movieId: string

    @IsNotEmpty()
    @IsString()
    sagaId: string

    @IsDate()
    @Type(() => Date)
    startTime: Date

    @IsNotEmpty()
    @IsString()
    theaterId: string
}
