import { Type } from 'class-transformer'
import { ArrayNotEmpty, IsArray, IsDate, IsNotEmpty, IsPositive, IsString } from 'class-validator'

export class ShowtimeBatchCreateDto {
    @IsString()
    @IsNotEmpty()
    movieId: string

    @IsArray()
    @ArrayNotEmpty()
    @IsString({ each: true })
    theaterIds: string[]

    @IsPositive()
    @IsNotEmpty()
    durationMinutes: number

    @IsArray()
    @ArrayNotEmpty()
    @IsDate({ each: true })
    @Type(() => Date)
    startTimes: Date[]
}
