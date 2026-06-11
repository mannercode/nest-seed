import { ArrayNotEmpty, IsArray, IsString } from 'class-validator'

/**
 * `POST /showtime-creation/showtimes/search`가 받는 본문이다.
 * 극장 ID 목록만 받아서 해당 극장들의 아직 끝나지 않은 상영을 조회한다.
 */
export class SearchShowtimesByTheatersBodyDto {
    @ArrayNotEmpty()
    @IsArray()
    @IsString({ each: true })
    theaterIds: string[]
}
