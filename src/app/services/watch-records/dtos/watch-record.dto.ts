import { WatchRecord } from '../models'

export class WatchRecordDto {
    id: string
    customerId: string
    movieId: string
    purchaseId: string
    watchDate: Date

    constructor(watchRecord: WatchRecord) {
        const { createdAt, updatedAt, __v, ...rest } = watchRecord

        Object.assign(this, rest)
    }
}
