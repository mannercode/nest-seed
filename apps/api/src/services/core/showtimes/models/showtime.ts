import { CrudDocument } from '@mannercode/common'

export class Showtime extends CrudDocument {
    endTime: Temporal.Instant

    movieId: string

    sagaId: string

    startTime: Temporal.Instant

    theaterId: string
}
