import { CrudDocument } from '@mannercode/common'
import type { Seatmap } from './seatmap.js'
import type { TheaterLocation } from './theater-location.js'

export class Theater extends CrudDocument {
    location: TheaterLocation

    name: string

    seatmap: Seatmap

    // 상영 검증과 생성을 MongoDB 트랜잭션 안에서 극장 단위로 직렬화하는 내부 버전이다.
    showtimeScheduleVersion: number
}
