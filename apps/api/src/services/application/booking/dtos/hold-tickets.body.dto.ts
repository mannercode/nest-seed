import { ArrayNotEmpty, IsArray, IsString } from 'class-validator'

// `POST /booking/showtimes/:showtimeId/tickets/hold` 가 받는 본문이다.
// 사용자 ID 는 JWT 에서, 상영 ID 는 URL 파라미터에서 가져온다. 본문에는
// 잡을 티켓 ID 만 받는다.
export class HoldTicketsBodyDto {
    @ArrayNotEmpty()
    @IsArray()
    @IsString({ each: true })
    ticketIds: string[]
}
