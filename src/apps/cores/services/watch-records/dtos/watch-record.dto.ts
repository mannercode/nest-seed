import { BaseDto } from "common"

export class WatchRecordDto extends BaseDto {
    id: string
    customerId: string
    movieId: string
    purchaseId: string
    watchDate: Date
}

export const nullWatchRecordDto = {
    id: '',
    customerId: '',
    movieId: '',
    purchaseId: '',
    watchDate: new Date(0)
}
