export class CreateWatchRecordDto {
    userId: string

    movieId: string

    purchaseRecordId: string

    watchDate: Temporal.Instant
}
