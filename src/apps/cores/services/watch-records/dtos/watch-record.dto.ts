

export class WatchRecordDto {
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
