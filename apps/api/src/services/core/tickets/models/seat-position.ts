// Theater.Seat와 형태는 같지만 티켓에 고정된 좌표 값이라 별도 모델로 둔다.
export class SeatPosition {
    block: string

    row: string

    seatNumber: number
}
