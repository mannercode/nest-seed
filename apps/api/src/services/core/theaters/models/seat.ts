import { IsNotEmpty, IsNumber, IsString } from 'class-validator'

// Ticket의 좌석 좌표와 형태는 같지만 극장 좌석 자체의 속성이 늘 수 있어 별도 모델로 둔다.
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
