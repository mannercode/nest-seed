import { Type } from 'class-transformer'
import { ArrayNotEmpty, IsArray, IsDate, IsNotEmpty, IsPositive, IsString } from 'class-validator'

export class BulkCreateShowtimesDto {
    @IsNotEmpty()
    @IsPositive()
    durationInMinutes: number

    @IsNotEmpty()
    @IsString()
    movieId: string

    @ArrayNotEmpty()
    @IsArray()
    @IsDate({ each: true })
    @Type(() => Date)
    startTimes: Date[]

    @ArrayNotEmpty()
    @IsArray()
    @IsString({ each: true })
    theaterIds: string[]
}
