import type { BulkCreateShowtimesDto } from '../dtos'

export class ShowtimeCreationJobData {
    createDto: BulkCreateShowtimesDto
    sagaId: string
}

export enum ShowtimeCreationStatus {
    Waiting = 'waiting',
    Processing = 'processing',
    Compensating = 'compensating',
    CompensationFailed = 'compensation_failed',
    Succeeded = 'succeeded',
    Failed = 'failed',
    Error = 'error'
}
