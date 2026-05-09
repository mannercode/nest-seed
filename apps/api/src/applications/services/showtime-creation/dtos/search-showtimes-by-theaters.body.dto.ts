import { ArrayNotEmpty, IsArray, IsString } from 'class-validator'

// `POST /showtime-creation/showtimes/search` 의 HTTP body. theaterIds 배열만
// 받아 해당 극장들의 (현재 시각 이후) 상영시간을 조회한다.
export class SearchShowtimesByTheatersBodyDto {
    @ArrayNotEmpty()
    @IsArray()
    @IsString({ each: true })
    theaterIds: string[]
}
