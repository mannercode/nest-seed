import { IsNotEmpty, IsNumber, IsString } from 'class-validator'

/**
 * 극장이 정의하는 좌석. 지금은 좌표 (블록/열/번호) 만 갖지만, 향후 등급, 통로
 * 여부, 가격 책정 단위 등으로 확장될 수 있는 도메인 모델이다.
 *
 * Ticket 이 들고 있는 좌석 좌표는 별도의 SeatPosition 값 객체로 분리되어 있다.
 * 자료 구조가 우연히 같다고 같은 모델을 강제로 공유하지 않는다 — 두 도메인의
 * 본질이 다르다.
 */
export class Seat {
    @IsNotEmpty()
    @IsString()
    block: string

    @IsNotEmpty()
    @IsString()
    row: string

    @IsNumber()
    seatNumber: number
}
