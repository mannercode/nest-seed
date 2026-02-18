import type { BulkCreateShowtimesDto } from '../dtos'

export enum ShowtimeCreationStatus {
    Error = 'error',
    Failed = 'failed',
    Processing = 'processing',
    Succeeded = 'succeeded',
    Waiting = 'waiting'
}

export class ShowtimeCreationJobData {
    createDto: BulkCreateShowtimesDto
    sagaId: string
}
