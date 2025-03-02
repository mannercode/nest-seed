export class ShowtimeBatchCreateResult {
    batchId: string
    status: string
    showtimeCreatedCount: number
    ticketCreatedCount: number
}

export enum ShowtimeBatchCreateStatus {
    waiting = 'waiting',
    processing = 'processing',
    complete = 'complete',
    fail = 'fail',
    error = 'error'
}
