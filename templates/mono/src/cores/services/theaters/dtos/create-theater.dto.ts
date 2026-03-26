import { Type } from 'class-transformer'
import { IsNotEmpty, IsString, ValidateNested } from 'class-validator'
import { Seatmap, TheaterLocation } from '../models'

export class CreateTheaterDto {
    @IsNotEmpty()
    @Type(() => TheaterLocation)
    @ValidateNested()
    location: TheaterLocation

    @IsNotEmpty()
    @IsString()
    name: string

    @IsNotEmpty()
    @Type(() => Seatmap)
    @ValidateNested()
    seatmap: Seatmap
}
