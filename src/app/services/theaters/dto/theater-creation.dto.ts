import { Type } from 'class-transformer'
import { IsNotEmpty, IsString, ValidateNested } from 'class-validator'
import { LatLong } from 'common'
import { Seatmap } from '../schemas'

export class TheaterCreationDto {
    @IsString()
    @IsNotEmpty()
    name: string

    @ValidateNested()
    @Type(() => LatLong)
    latlong: LatLong

    @IsNotEmpty()
    seatmap: Seatmap
}
