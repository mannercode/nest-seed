import { Type } from 'class-transformer'
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator'
import { PartialDateTimeRange } from 'common'

export class SearchShowtimesDto {
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    sagaIds?: string[]

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    movieIds?: string[]

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    theaterIds?: string[]

    @IsOptional()
    @ValidateNested()
    @Type(() => PartialDateTimeRange)
    startTimeRange?: PartialDateTimeRange

    @IsOptional()
    @ValidateNested()
    @Type(() => PartialDateTimeRange)
    endTimeRange?: PartialDateTimeRange
}
