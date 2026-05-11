import { ArrayNotEmpty, IsArray, IsString } from 'class-validator'

// `POST /showtime-creation/showtimes/search` 가 받는 본문이다. 극장 ID 목록만
// 받아서, 그 극장들의 현재 시각 이후 상영을 조회한다.
export class SearchShowtimesByTheatersBodyDto {
    @ArrayNotEmpty()
    @IsArray()
    @IsString({ each: true })
    theaterIds: string[]
}
