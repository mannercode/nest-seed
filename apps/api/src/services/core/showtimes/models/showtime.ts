import { CrudDocument } from '@mannercode/common'

export class Showtime extends CrudDocument {
    endTime: Date

    movieId: string

    sagaId: string

    startTime: Date

    theaterId: string
}
