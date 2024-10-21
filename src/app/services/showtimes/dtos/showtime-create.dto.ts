import { IsDate, IsNotEmpty, IsString } from 'class-validator'

export class ShowtimeCreateDto {
    @IsString()
    @IsNotEmpty()
    movieId: string

    @IsString()
    @IsNotEmpty()
    theaterId: string

    @IsDate()
    // @Type(() => Date) controller에서 사용하지 않아서 제거함
    startTime: Date

    @IsDate()
    // @Type(() => Date) controller에서 사용하지 않아서 제거함
    endTime: Date

    @IsString()
    @IsNotEmpty()
    batchId: string
}
