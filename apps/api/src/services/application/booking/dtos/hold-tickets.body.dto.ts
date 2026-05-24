import { ArrayNotEmpty, IsArray, IsString } from 'class-validator'

/**
 * `POST /booking/showtimes/:showtimeId/tickets/hold`가 받는 본문이다.
 * 사용자 ID는 JWT에서, 상영 ID는 URL 파라미터에서 가져오므로 본문에는 선점할 티켓 ID만 받는다.
 */
export class HoldTicketsBodyDto {
    @ArrayNotEmpty()
    @IsArray()
    @IsString({ each: true })
    ticketIds: string[]
}
