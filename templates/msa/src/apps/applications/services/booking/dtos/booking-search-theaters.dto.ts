import { LatLong } from '@mannercode/common'
import { Type } from 'class-transformer'
import { IsNotEmpty, IsString, ValidateNested } from 'class-validator'

export class BookingSearchTheatersDto {
    @IsNotEmpty()
    @Type(() => LatLong)
    @ValidateNested()
    latLong: LatLong

    @IsNotEmpty()
    @IsString()
    movieId: string
}
