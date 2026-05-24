import { IsNotEmpty, IsNumber, IsString } from 'class-validator'

/**
 * 티켓이 가리키는 좌석의 좌표.
 * Theater의 `Seatmap`에 논리적으로 묶이지만 코드 의존은 두지 않는다.
 * core 안의 도메인끼리는 서로 가져오지 않는 규칙을 따른다.
 *
 * `Theater.Seat`와 자료 구조가 같지만 의미가 다르다.
 * 해당 모델은 시간이 지나며 등급·가격·통로 정보까지 늘어날 수 있는 도메인 모델이고, 여기는 좌표만 들고 있는 값 객체로 둔다.
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
