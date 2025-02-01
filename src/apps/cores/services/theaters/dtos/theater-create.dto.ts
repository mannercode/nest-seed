import { Type } from 'class-transformer'
import { IsNotEmpty, IsString, ValidateNested } from 'class-validator'
import { BaseDto, LatLong } from 'common'
import { Seatmap } from '../models'

export class TheaterCreateDto extends BaseDto {
    @IsString()
    @IsNotEmpty()
    name: string

    @IsNotEmpty()
    @ValidateNested()
    @Type(() => LatLong)
    latlong: LatLong

    @IsNotEmpty()
    @ValidateNested()
    @Type(() => Seatmap)
    seatmap: Seatmap
}
