import { CrudDocument } from '@mannercode/common'

export class WatchRecord extends CrudDocument {
    userId: string

    movieId: string

    purchaseRecordId: string

    watchDate: Temporal.Instant
}
