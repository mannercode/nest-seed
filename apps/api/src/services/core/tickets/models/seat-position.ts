import { IsNotEmpty, IsNumber, IsString } from 'class-validator'

/**
 * 티켓이 가리키는 좌석 좌표. Theater 의 좌석 구조 (Seatmap) 에 논리적으로
 * 종속되지만 코드 의존은 두지 않는다 — core 의 형제 도메인은 서로 import 하지
 * 못하기 때문이다.
 *
 * Theater 의 Seat 와 자료 구조가 같지만 본질이 다르다. Theater 의 Seat 는
 * 풍성해질 수 있는 도메인 모델이고, 여기는 좌표만 들고 있는 값 객체로 머문다.
 */
export class SeatPosition {
    @IsNotEmpty()
    @IsString()
    block: string

    @IsNotEmpty()
    @IsString()
    row: string

    @IsNumber()
    seatNumber: number
}
