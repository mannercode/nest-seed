import { CrudDocument } from '@mannercode/common'
import type { Seatmap } from './seatmap.js'
import type { TheaterLocation } from './theater-location.js'

export class Theater extends CrudDocument {
    location: TheaterLocation

    name: string

    seatmap: Seatmap

    // 상영 검증과 생성을 MongoDB 트랜잭션 안에서 극장 단위로 직렬화하는 내부 버전이다.
    // 기존 문서에 필드가 없어도 $inc가 0에서 시작하므로 별도 데이터 마이그레이션이 필요 없다.
    showtimeScheduleVersion: number
}
