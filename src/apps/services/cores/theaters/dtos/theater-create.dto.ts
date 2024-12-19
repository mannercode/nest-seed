import { Type } from 'class-transformer'
import { IsNotEmpty, IsString, ValidateNested } from 'class-validator'
import { LatLong } from 'common'
import { Seatmap } from '../models'

export class TheaterCreateDto {
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
