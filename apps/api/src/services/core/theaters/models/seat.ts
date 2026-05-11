import { IsNotEmpty, IsNumber, IsString } from 'class-validator'

/**
 * 극장이 정의하는 좌석. 지금은 좌표(블록·열·번호) 만 들고 있지만, 등급·통로
 * 여부·가격 단위 같은 속성이 시간이 지나면서 늘어날 수 있는 도메인 모델이다.
 *
 * Ticket 쪽에서 들고 있는 좌석 좌표는 따로 `SeatPosition` 값 객체로 두었다.
 * 두 도메인의 의미가 다르므로, 자료 구조가 같다는 이유만으로 한 모델을
 * 공유하지 않는다.
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
