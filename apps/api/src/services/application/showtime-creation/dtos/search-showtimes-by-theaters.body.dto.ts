import { ArrayNotEmpty, IsArray, IsString } from 'class-validator'

export class SearchShowtimesByTheatersBodyDto {
    @ArrayNotEmpty()
    @IsArray()
    @IsString({ each: true })
    theaterIds: string[]
}
