import { Type } from 'class-transformer'
import { IsDate, IsNotEmpty, IsString } from 'class-validator'

export class ShowtimeCreationDto {
    @IsString()
    @IsNotEmpty()
    movieId: string

    @IsString()
    @IsNotEmpty()
    theaterId: string

    @IsDate()
    @Type(() => Date)
    startTime: Date

    @IsDate()
    @Type(() => Date)
    endTime: Date

    @IsString()
    @IsNotEmpty()
    batchId: string
}
