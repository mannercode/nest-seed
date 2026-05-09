import { ArrayNotEmpty, IsArray, IsString } from 'class-validator'

// `POST /booking/showtimes/:showtimeId/tickets/hold` 의 HTTP body. userId 는
// JWT 에서, showtimeId 는 URL param 에서 오므로 body 에는 ticketIds 만 받는다.
export class HoldTicketsBodyDto {
    @ArrayNotEmpty()
    @IsArray()
    @IsString({ each: true })
    ticketIds: string[]
}
