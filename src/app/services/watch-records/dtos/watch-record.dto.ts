import { WatchRecord } from '../models'

export class WatchRecordDto {
    id: string
    customerId: string
    movieId: string
    purchaseId: string
    watchDate: Date

    constructor(watchRecord: WatchRecord) {
        // const { id, customerId, movieId, purchaseId, watchDate } = watchRecord

        // Object.assign(this, {
        //     id:id.toString(),
        //     customerId: customerId.toString(),
        //     movieId: movieId.toString(),
        //     purchaseId: purchaseId.toString(),
        //     watchDate
        // })
        const { createdAt, updatedAt, __v, ...rest } = watchRecord

        Object.assign(this, rest)
    }
}
