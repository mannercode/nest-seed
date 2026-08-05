import { Type } from 'class-transformer'
import {
    ArrayNotEmpty,
    ArrayMaxSize,
    ArrayUnique,
    IsArray,
    IsDate,
    IsNotEmpty,
    IsPositive,
    IsString
} from 'class-validator'

export class BulkCreateShowtimesDto {
    @IsNotEmpty()
    @IsPositive()
    durationInMinutes: number

    @IsNotEmpty()
    @IsString()
    movieId: string

    @ArrayNotEmpty()
    @ArrayMaxSize(20)
    @IsArray()
    @IsDate({ each: true })
    @Type(() => Date)
    startTimes: Date[]

    @ArrayNotEmpty()
    @ArrayMaxSize(20)
    @ArrayUnique()
    @IsArray()
    @IsString({ each: true })
    theaterIds: string[]
}
